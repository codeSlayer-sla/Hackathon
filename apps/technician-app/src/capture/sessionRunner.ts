import {
  getCaptureSession,
  updateCaptureSession,
  deleteCaptureSession,
  insertObservations,
  getOperatingCountry,
} from '../db/database';
import { extractFromTranscript } from '../qvac/extraction';
import type { ConversationTurn } from '../qvac/models';

export interface DisplayMessage {
  role: 'user' | 'agent';
  text: string;
}

/**
 * Runs one turn of a capture session end to end, reading and writing
 * exclusively through SQLite -- no reference to any React component. Meant
 * to be fired without awaiting from the UI: if the screen showing this
 * session unmounts mid-request (user switched tabs or opened another
 * session), this keeps running and persists its result regardless, which is
 * the whole point -- a session's progress must survive not being looked at.
 */
export async function runSessionTurn(
  sessionId: number,
  llmId: string,
  userText: string,
  source: 'text' | 'voice',
  technicianName: string
): Promise<void> {
  const session = await getCaptureSession(sessionId);
  if (!session) return; // deleted/discarded already -- nothing to do

  const history: ConversationTurn[] = JSON.parse(session.history_json);
  const messages: DisplayMessage[] = JSON.parse(session.messages_json);
  messages.push({ role: 'user', text: userText });
  await updateCaptureSession(sessionId, { messagesJson: JSON.stringify(messages), status: 'processing' });

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
        historyJson: JSON.stringify(updatedHistory),
        messagesJson: JSON.stringify(messages),
        status: 'done',
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

export async function discardSessionIfDone(sessionId: number): Promise<void> {
  const session = await getCaptureSession(sessionId);
  if (session && session.status === 'done') {
    await deleteCaptureSession(sessionId);
  }
}
