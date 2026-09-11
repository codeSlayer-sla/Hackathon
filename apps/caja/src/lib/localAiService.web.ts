/**
 * Web platform binding for `LocalAIService`.
 *
 * QVAC runs inside `react-native-bare-kit` (a native-only Bare runtime), so it
 * is NOT available on Expo Web. On web we keep a clearly marked deterministic
 * demo fallback — this is NOT a fake of QVAC, and no QVAC code is imported in
 * this bundle. Android/iOS use the real service in `localAiService.native.ts`.
 *
 * Metro resolves this file for web (`*.web.ts` beats the base file); tsc uses
 * the base `localAiService.ts` for module resolution.
 */
import { LocalAIService, LocalMockAIService } from "./localAi";

export const localAiService: LocalAIService = new LocalMockAIService(
  "Web · demo local (QVAC no disponible en navegador)"
);