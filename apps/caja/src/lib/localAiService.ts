/**
 * Base binding for `LocalAIService` (type-checking only).
 *
 * Metro never bundles this file: on web it resolves `localAiService.web.ts`
 * and on Android/iOS it resolves `localAiService.native.ts`. This base file
 * exists so TypeScript can resolve the import path (tsc does not understand
 * Metro's platform-specific suffixes). Its value is the safe mock, mirroring
 * the web fallback — it is never executed at runtime.
 */
import { LocalAIService, LocalMockAIService } from "./localAi";

export const localAiService: LocalAIService = new LocalMockAIService(
  "Local mock (base)"
);