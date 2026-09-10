import {
  loadModel,
  unloadModel,
  completion,
  transcribe,
  LLAMA_3_2_1B_INST_Q4_0,
  WHISPER_TINY,
} from '@qvac/sdk';

type ProgressCallback = (pct: number, mbDl: number, mbTotal: number) => void;

let llmModelId: string | null = null;
let whisperModelId: string | null = null;

// Module-level, so it survives across CaptureScreen mounts/unmounts within
// the same running app (tab switches never re-load it). What DOES force a
// real reload is the app's whole JS process dying -- e.g. Android's
// low-memory killer, and this app is a natural target for that since it
// holds a large model in RAM. That reload time is unavoidable (RAM is
// always empty on a fresh process); what's avoidable is making the
// technician sit and watch it, hence preloadLLM below.
let llmLoadPromise: Promise<string> | null = null;
const llmProgressListeners = new Set<ProgressCallback>();

function notifyLLMProgress(pct: number, mbDl: number, mbTotal: number): void {
  for (const cb of llmProgressListeners) cb(pct, mbDl, mbTotal);
}

/**
 * Kicks off the LLM load without waiting for it or requiring a progress
 * listener -- meant to be called once, as early as possible (app boot,
 * before login even resolves), so that by the time the technician actually
 * opens a capture session the model is already loaded or close to it.
 * Safe to call multiple times; only the first call actually starts a load.
 */
export function preloadLLM(): void {
  void ensureLLM();
}

/** Synchronous check so a screen can skip ever rendering a loading state
 * when the model is already loaded, instead of always awaiting ensureLLM
 * and flashing a loading screen for one render even when it's instant. */
export function getLoadedLLMId(): string | null {
  return llmModelId;
}

export function ensureLLM(onProgress?: ProgressCallback): Promise<string> {
  if (llmModelId) return Promise.resolve(llmModelId);
  if (onProgress) llmProgressListeners.add(onProgress);
  if (!llmLoadPromise) {
    llmLoadPromise = loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      // Forced to CPU: QVAC's own docs list Android as having no physical-device
      // GPU acceptance yet, and this app hit a native crash right as the model
      // finished loading (the moment GPU buffer allocation would kick in).
      // `predict` hard-caps generated tokens per response -- without it a small
      // model that falls into a repetition loop (a real, known failure mode,
      // seen on garbled input) never naturally emits EOS and generation runs
      // indefinitely, which looks exactly like the app "never answering."
      // Tightened from 512 -> 300 now that follow_up_question is grammar-
      // forced to null and missing_required is a 3-value enum -- the
      // realistic output shape is much smaller than before, so the cap can
      // be too, which bounds worst-case latency further.
      // `cache-type-k/v: q8_0` was tried here (halves KV cache memory) but
      // reverted -- the app started crashing on open right after adding it,
      // on the same build that also made this loadModel call fire immediately
      // at boot instead of lazily on first Capturar visit. Backed out since
      // it's the one genuinely untested-on-device config in that batch;
      // revisit with real logcat evidence before trying again.
      modelConfig: { device: 'cpu', ctx_size: 2048, predict: 300 },
      onProgress: (p) => notifyLLMProgress(p.percentage, p.downloaded / 1e6, p.total / 1e6),
    })
      .then((id) => {
        llmModelId = id;
        llmProgressListeners.clear();
        return id;
      })
      .catch((e) => {
        llmLoadPromise = null; // allow retrying instead of caching the failure forever
        llmProgressListeners.clear();
        throw e;
      });
  }
  return llmLoadPromise;
}

export async function ensureWhisper(onProgress?: ProgressCallback): Promise<string> {
  if (whisperModelId) return whisperModelId;
  whisperModelId = await loadModel({
    modelSrc: WHISPER_TINY,
    modelConfig: {
      audio_format: 'f32le',
      // Beam search over greedy: real accuracy gain for Whisper at the same
      // model size, and unlike the LLM chat this is a one-shot transcription
      // per voice note, not a repeated multi-turn cost, so the extra latency
      // is a fine trade. WHISPER_TINY is the only Whisper size this SDK
      // version exports as a named model -- not swapping to a bigger one
      // blind since no other size is verifiable without a live registry query.
      strategy: 'beam_search',
      beam_search_beam_size: 5,
      n_threads: 4,
      language: 'es',
      no_timestamps: true,
      suppress_blank: true,
      temperature: 0.0,
      vad_params: {
        threshold: 0.35,
        min_speech_duration_ms: 200,
        min_silence_duration_ms: 150,
        max_speech_duration_s: 30.0,
        speech_pad_ms: 400,
      },
    },
    onProgress: (p) => {
      onProgress?.(p.percentage, p.downloaded / 1e6, p.total / 1e6);
    },
  });
  return whisperModelId;
}

export interface ConversationTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOutcome {
  text: string;
  // Canonical assistant text to push back into `history` for the next turn
  // when kvCache is on -- re-using it verbatim guarantees a cache hit, so
  // only the new message gets reprocessed instead of the whole conversation.
  cacheableAssistantContent?: string;
}

// Only one loaded LLM instance exists on-device, and it can only actually
// run one inference at a time -- with multiple capture sessions now able to
// trigger a completion independently, this chains every call through a
// single queue so a second session's request waits its turn instead of
// racing/rejecting against the model that's still busy with the first.
let llmQueue: Promise<unknown> = Promise.resolve();

export function runCompletion(
  modelId: string,
  history: ConversationTurn[],
  responseFormat?: Parameters<typeof completion>[0]['responseFormat']
): Promise<CompletionOutcome> {
  const task = llmQueue.then(() => runCompletionNow(modelId, history, responseFormat));
  llmQueue = task.catch(() => {});
  return task;
}

async function runCompletionNow(
  modelId: string,
  history: ConversationTurn[],
  responseFormat?: Parameters<typeof completion>[0]['responseFormat']
): Promise<CompletionOutcome> {
  const run = completion({
    modelId,
    history,
    stream: false,
    responseFormat,
    kvCache: true,
  });
  const final = await run.final;
  return {
    text: final.contentText ?? '',
    cacheableAssistantContent: final.cacheableAssistantContent,
  };
}

export async function runTranscription(modelId: string, audioPath: string): Promise<string> {
  const segments = await transcribe({ modelId, audioChunk: audioPath, metadata: true });
  const arr = Array.isArray(segments) ? segments : [segments];
  return arr.map((s: any) => (typeof s === 'string' ? s : s.text ?? '')).join('').trim();
}

export async function releaseModels(): Promise<void> {
  if (llmModelId) {
    await unloadModel({ modelId: llmModelId }).catch(() => {});
    llmModelId = null;
  }
  if (whisperModelId) {
    await unloadModel({ modelId: whisperModelId }).catch(() => {});
    whisperModelId = null;
  }
}
