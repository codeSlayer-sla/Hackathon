/**
 * Strips Qwen3 `<think>` reasoning blocks from model output.
 *
 * Qwen3 instruction-tuned models wrap chain-of-thought in
 * `<think>reasoning</think>answer` pairs.  When the QVAC SDK is called
 * without `captureThinking: true`, the tags leak into `contentText`
 * and reach the UI.  This module removes them post-hoc.
 *
 * Two regexes, matching the SDK's own `cache-normalize.js`:
 *   1. Closed blocks: `<think>…</think>` (case-insensitive)
 *   2. Unclosed trailing: `<think>…` at end-of-string (stop token mid-thought)
 */

const THINK_BLOCK_RE = /<think>[\s\S]*?<\/think>/gi;
const UNCLOSED_TRAILING_THINK_RE = /<think>[\s\S]*$/i;

export function cleanResponse(raw: string): string {
  return raw.replace(THINK_BLOCK_RE, "").replace(UNCLOSED_TRAILING_THINK_RE, "").trim();
}
