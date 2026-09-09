import {
  getCaptureSession,
  updateCaptureSession,
  deleteCaptureSession,
  insertObservations,
  getOperatingCountry,
} from '../db/database';
import { extractFromTranscript, type ExtractionResult } from '../qvac/extraction';
import type { ConversationTurn } from '../qvac/models';

export interface DisplayMessage {
  role: 'user' | 'agent';
  text: string;
}

// What actually gets saved once confirmed -- result plus the country already
// resolved (deterministic override applied once here, not recomputed later)
// and which turn's modality produced it, so confirmSession doesn't need
// either passed back in from outside.
interface PendingResult {
  result: ExtractionResult;
  country: string | null;
  source: 'text' | 'voice';
}

function formatReviewSummary(result: ExtractionResult, country: string | null): string {
  const equipmentLines = result.equipment
    .map((e) => `• ${e.quantity ?? '?'}x ${e.modality}${e.brand ? ` (${e.brand}${e.model ? ` ${e.model}` : ''})` : ''}${e.approx_age_years ? `, ~${e.approx_age_years} años` : ''}`)
    .join('\n');
  const location = [result.city, country].filter(Boolean).join(', ') || 'sin especificar';
  return (
    `📝 Listo para guardar -- revisa antes de confirmar:\n\n` +
    `Cliente: ${result.customer}\n` +
    `Ubicación: ${location}\n` +
    `Equipos:\n${equipmentLines}\n\n` +
    `Si algo está mal, escríbelo (ej. "en realidad son 3 equipos" o "el modelo es X"). ` +
    `Si está correcto, toca "Confirmar y guardar".`
  );
}

/**
 * Appends the user's message and marks the session 'processing' -- split out
 * from runSessionTurn specifically so the UI can `await` this one small
 * write before it starts polling. Polling and the actual model call used to
 * race: nothing guaranteed this write landed before the first poll read, so
 * a poll could catch the session still in its pre-turn state and either
 * stomp the just-sent message back to "not there yet" or see a non-
 * 'processing' status and stop polling prematurely -- both looked exactly
 * like "my message doesn't show until I leave and reopen the session."
 */
export async function beginSessionTurn(sessionId: number, userText: string): Promise<void> {
  const session = await getCaptureSession(sessionId);
  if (!session) return;
  const messages: DisplayMessage[] = JSON.parse(session.messages_json);
  messages.push({ role: 'user', text: userText });
  // Any new turn invalidates a prior pending review -- a typed correction
  // instead of a confirm must not leave a stale result sitting around.
  await updateCaptureSession(sessionId, {
    messagesJson: JSON.stringify(messages),
    pendingResultJson: null,
    status: 'processing',
  });
}

/**
 * Runs one turn of a capture session end to end, reading and writing
 * exclusively through SQLite -- no reference to any React component. Meant
 * to be fired without awaiting from the UI (call beginSessionTurn first,
 * awaited): if the screen showing this session unmounts mid-request (user
 * switched tabs or opened another session), this keeps running and persists
 * its result regardless, which is the whole point -- a session's progress
 * must survive not being looked at.
 */
export async function runSessionTurn(
  sessionId: number,
  llmId: string,
  userText: string,
  source: 'text' | 'voice'
): Promise<void> {
  const session = await getCaptureSession(sessionId);
  if (!session) return; // deleted/discarded already -- nothing to do

  const history: ConversationTurn[] = JSON.parse(session.history_json);
  // Already includes the user's message -- beginSessionTurn persisted it.
  const messages: DisplayMessage[] = JSON.parse(session.messages_json);

  try {
    const { result, history: updatedHistory } = await extractFromTranscript(llmId, history, userText);
    // Sessions default to a generic "Nueva visita" label -- with several
    // open at once, that's indistinguishable in the list. Update it to the
    // customer name as soon as the model identifies one, on every turn (not
    // just the final save), so the list is always identifiable while a
    // session is still in progress.
    if (result.customer) {
      await updateCaptureSession(sessionId, { label: result.customer });
    }

    if (result.ready_to_save && result.customer && result.equipment.length > 0) {
      // Deterministic, not left to the model: a technician works a whole
      // trip within one country, and the model has no real signal for it
      // unless the user actually says it -- guessing produced wrong
      // countries in testing. The configured country always wins when set.
      const operatingCountry = await getOperatingCountry();
      const country = operatingCountry || result.country;

      // The model claiming "ready" is not the same as it being correct --
      // quantity/brand/model have no deterministic override the way country
      // does, and testing showed real hallucinations here. Hold for an
      // explicit human confirm instead of saving straight to observations;
      // a correction typed here just becomes the next normal turn.
      const pending: PendingResult = { result, country, source };
      messages.push({ role: 'agent', text: formatReviewSummary(result, country) });
      await updateCaptureSession(sessionId, {
        historyJson: JSON.stringify(updatedHistory),
        messagesJson: JSON.stringify(messages),
        pendingResultJson: JSON.stringify(pending),
        status: 'review',
      });
    } else {
      const follow = result.follow_up_question ?? '¿Puedes darme más detalles?';
      messages.push({ role: 'agent', text: follow });
      await updateCaptureSession(sessionId, {
        historyJson: JSON.stringify(updatedHistory),
        messagesJson: JSON.stringify(messages),
        status: 'idle',
      });
    }
  } catch (e: any) {
    messages.push({ role: 'agent', text: `Error: ${e.message}` });
    await updateCaptureSession(sessionId, { messagesJson: JSON.stringify(messages), status: 'idle' });
  }
}

/**
 * Commits a session's pending (human-confirmed) result to observations.
 * Only meaningful when the session is in 'review' -- if the pending result
 * is gone (e.g. a correction was typed instead, which reruns runSessionTurn
 * and clears it), this is a no-op rather than saving stale data.
 */
export async function confirmSession(sessionId: number, technicianName: string): Promise<void> {
  const session = await getCaptureSession(sessionId);
  if (!session || !session.pending_result_json) return;

  const pending: PendingResult = JSON.parse(session.pending_result_json);
  const messages: DisplayMessage[] = JSON.parse(session.messages_json);
  const { result, country, source } = pending;
  if (!result.customer) return; // shouldn't happen -- only stored once customer was set

  const saved = await insertObservations(
    result.customer,
    result.city,
    country,
    result.equipment,
    technicianName,
    source
  );
  const summary = saved
    .map((o) => `${o.quantity ?? '?'}x ${o.modality}${o.brand ? ` (${o.brand})` : ''}`)
    .join(', ');
  messages.push({
    role: 'agent',
    text: `✅ Guardado para ${result.customer}: ${summary}. Datos listos para sincronizar con el servidor Philips.`,
  });
  // Kept as "done" (not deleted) so whoever is actively watching this
  // session sees the confirmation -- the chat view deletes it when the
  // technician leaves that screen, since the data now lives in
  // observations, not here.
  await updateCaptureSession(sessionId, {
    messagesJson: JSON.stringify(messages),
    pendingResultJson: null,
    status: 'done',
  });
}

export async function discardSessionIfDone(sessionId: number): Promise<void> {
  const session = await getCaptureSession(sessionId);
  if (session && session.status === 'done') {
    await deleteCaptureSession(sessionId);
  }
}
