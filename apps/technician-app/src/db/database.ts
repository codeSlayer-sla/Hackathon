import * as SQLite from 'expo-sqlite';
import type { EquipmentItem } from '../qvac/extraction';

export interface LocalObservation {
  id: number;
  customer: string;
  city: string | null;
  country: string | null;
  modality: string;
  quantity: number | null;
  brand: string | null;
  model: string | null;
  approx_age_years: number | null;
  confidence: string;
  status: string;
  source: string;
  observer: string;
  visit_date: string;
  sync_status: 'pending' | 'synced' | 'failed';
  created_at: string;
}

let _db: SQLite.SQLiteDatabase | null = null;

function db(): SQLite.SQLiteDatabase {
  if (!_db) throw new Error('Database not initialized — call initDatabase() first');
  return _db;
}

export async function initDatabase(): Promise<void> {
  _db = await SQLite.openDatabaseAsync('technician.db');
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer TEXT NOT NULL,
      city TEXT,
      country TEXT,
      modality TEXT NOT NULL,
      quantity INTEGER,
      brand TEXT,
      model TEXT,
      approx_age_years REAL,
      confidence TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'reported',
      source TEXT NOT NULL DEFAULT 'text',
      observer TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS technicians_cache (
      technician_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export async function insertObservations(
  customer: string,
  city: string | null,
  country: string | null,
  equipment: EquipmentItem[],
  observer: string,
  source: 'text' | 'voice' | 'photo'
): Promise<LocalObservation[]> {
  const today = new Date().toISOString().split('T')[0];
  const saved: LocalObservation[] = [];
  for (const item of equipment) {
    const result = await db().runAsync(
      `INSERT INTO observations
        (customer, city, country, modality, quantity, brand, model, approx_age_years, confidence, status, source, observer, visit_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer,
        city,
        country,
        item.modality,
        item.quantity,
        item.brand,
        item.model,
        item.approx_age_years,
        item.confidence,
        item.status,
        source,
        observer,
        today,
      ]
    );
    const row = await db().getFirstAsync<LocalObservation>(
      'SELECT * FROM observations WHERE id = ?',
      [result.lastInsertRowId]
    );
    if (row) saved.push(row);
  }
  return saved;
}

export async function listObservations(): Promise<LocalObservation[]> {
  return db().getAllAsync<LocalObservation>(
    'SELECT * FROM observations ORDER BY created_at DESC'
  );
}

export async function listPendingSync(): Promise<LocalObservation[]> {
  return db().getAllAsync<LocalObservation>(
    "SELECT * FROM observations WHERE sync_status = 'pending' ORDER BY created_at ASC"
  );
}

export async function markSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db().runAsync(
    `UPDATE observations SET sync_status = 'synced' WHERE id IN (${placeholders})`,
    ids
  );
}

export async function markSyncFailed(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db().runAsync(
    `UPDATE observations SET sync_status = 'failed' WHERE id IN (${placeholders})`,
    ids
  );
}

export async function countPending(): Promise<number> {
  const row = await db().getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) as n FROM observations WHERE sync_status = 'pending'"
  );
  return row?.n ?? 0;
}

export interface CachedTechnician {
  technician_id: string;
  name: string;
  pin_hash: string;
}

export async function cacheRoster(pepper: string, technicians: CachedTechnician[]): Promise<void> {
  await db().withTransactionAsync(async () => {
    await db().runAsync(
      "INSERT INTO app_settings (key, value) VALUES ('auth_pepper', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [pepper]
    );
    await db().runAsync('DELETE FROM technicians_cache');
    for (const t of technicians) {
      await db().runAsync(
        'INSERT INTO technicians_cache (technician_id, name, pin_hash) VALUES (?, ?, ?)',
        [t.technician_id, t.name, t.pin_hash]
      );
    }
  });
}

export async function getCachedPepper(): Promise<string | null> {
  const row = await db().getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'auth_pepper'"
  );
  return row?.value ?? null;
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await db().getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db().runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export async function getServerUrl(): Promise<string | null> {
  return getSetting('server_url');
}

export async function setServerUrl(url: string): Promise<void> {
  await setSetting('server_url', url.trim().replace(/\/+$/, ''));
}

export async function findCachedTechnicianByPinHash(
  pinHash: string
): Promise<{ technician_id: string; name: string } | null> {
  return db().getFirstAsync<{ technician_id: string; name: string }>(
    'SELECT technician_id, name FROM technicians_cache WHERE pin_hash = ?',
    [pinHash]
  );
}
