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
