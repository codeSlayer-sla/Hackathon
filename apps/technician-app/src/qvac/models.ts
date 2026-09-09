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

export async function ensureLLM(onProgress?: ProgressCallback): Promise<string> {
  if (llmModelId) return llmModelId;
  llmModelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    // Forced to CPU: QVAC's own docs list Android as having no physical-device
    // GPU acceptance yet, and this app hit a native crash right as the model
    // finished loading (the moment GPU buffer allocation would kick in).
    modelConfig: { device: 'cpu', ctx_size: 2048 },
    onProgress: (p) => {
      onProgress?.(p.percentage, p.downloaded / 1e6, p.total / 1e6);
    },
  });
  return llmModelId;
}

export async function ensureWhisper(onProgress?: ProgressCallback): Promise<string> {
  if (whisperModelId) return whisperModelId;
  whisperModelId = await loadModel({
    modelSrc: WHISPER_TINY,
    modelConfig: {
      audio_format: 'f32le',
      strategy: 'greedy',
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

export async function runCompletion(
  modelId: string,
  prompt: string,
  responseFormat?: Parameters<typeof completion>[0]['responseFormat']
): Promise<string> {
  const run = completion({
    modelId,
    history: [{ role: 'user', content: prompt }],
    stream: false,
    responseFormat,
  });
  const final = await run.final;
  return final.contentText ?? '';
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
