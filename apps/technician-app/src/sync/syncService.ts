import { listPendingSync, markSynced, markSyncFailed } from '../db/database';

// Change this to your Philips on-premise server URL
const PHILIPS_SERVER = process.env.EXPO_PUBLIC_PHILIPS_SERVER ?? 'http://192.168.1.100:8005';

export interface SyncResult {
  pushed: number;
  accepted: number;
  failed: number;
  error?: string;
}

export async function syncToServer(token: string): Promise<SyncResult> {
  const pending = await listPendingSync();
  if (pending.length === 0) return { pushed: 0, accepted: 0, failed: 0 };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const resp = await fetch(`${PHILIPS_SERVER}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pending_observations: pending.map((o) => ({
          local_id: o.id,
          customer: o.customer,
          city: o.city,
          country: o.country,
          modality: o.modality,
          quantity: o.quantity,
          brand: o.brand,
          model: o.model,
          approx_age_years: o.approx_age_years,
          confidence: o.confidence,
          status: o.status,
          source: o.source,
          observer: o.observer,
          visit_date: o.visit_date,
        })),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      await markSyncFailed(pending.map((o) => o.id));
      return { pushed: pending.length, accepted: 0, failed: pending.length, error: `HTTP ${resp.status}` };
    }

    const body = await resp.json();
    const acceptedIds: number[] = (body.accepted ?? []).map((a: any) => a.local_id ?? a).filter(Number.isInteger);
    const failedIds = pending.map((o) => o.id).filter((id) => !acceptedIds.includes(id));

    if (acceptedIds.length > 0) await markSynced(acceptedIds);
    if (failedIds.length > 0) await markSyncFailed(failedIds);

    return { pushed: pending.length, accepted: acceptedIds.length, failed: failedIds.length };
  } catch (err: any) {
    await markSyncFailed(pending.map((o) => o.id));
    return { pushed: pending.length, accepted: 0, failed: pending.length, error: err.message };
  }
}

export async function isServerReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5_000);
    const resp = await fetch(`${PHILIPS_SERVER}/health`, { signal: controller.signal });
    return resp.ok;
  } catch {
    return false;
  }
}
