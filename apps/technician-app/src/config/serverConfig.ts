import { getServerUrl as getStoredServerUrl, setServerUrl as setStoredServerUrl } from '../db/database';

// Only used if the user never configures one (e.g. first run before the
// setup screen runs) -- not meant to be relied on for a real demo network.
const FALLBACK_SERVER = process.env.EXPO_PUBLIC_PHILIPS_SERVER ?? null;

let cached: string | null | undefined; // undefined = not loaded yet from SQLite

export async function getServerUrl(): Promise<string | null> {
  if (cached === undefined) {
    cached = (await getStoredServerUrl()) ?? FALLBACK_SERVER;
  }
  return cached ?? null;
}

export async function setServerUrl(url: string): Promise<void> {
  const trimmed = url.trim().replace(/\/+$/, '');
  await setStoredServerUrl(trimmed);
  cached = trimmed;
}

export function looksLikeUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(value.trim());
}
