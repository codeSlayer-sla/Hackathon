"""SQLite persistence for installed-base observations, the photo review
queue, and idempotent-request caching.

Plain stdlib sqlite3, no ORM. Duplicate detection is a simple heuristic
(normalized customer name + same modality), not semantic matching; good
enough to flag "hey, check this" without blocking the save.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone

from qvac_mesh_shared import (
    AnalyticsSummary,
    ConfidenceLevel,
    CustomerSummary,
    EquipmentObservation,
    ObservationStatus,
    RefreshOpportunity,
)

AGING_THRESHOLD_YEARS = 8
FRESHNESS_THRESHOLD_DAYS = 90

_SCHEMA = """
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
    estimated_install_year INTEGER,
    confidence TEXT NOT NULL,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    observer TEXT,
    visit_date TEXT,
    notes TEXT,
    possible_duplicate_of TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photo_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_path TEXT NOT NULL,
    customer TEXT,
    technician_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    guessed_modality TEXT,
    guessed_brand TEXT,
    guessed_model TEXT,
    guessed_confidence TEXT,
    corrected_label TEXT,
    linked_observation_id INTEGER,
    created_at TEXT NOT NULL,
    processed_at TEXT
);

CREATE TABLE IF NOT EXISTS processed_events (
    client_event_id TEXT PRIMARY KEY,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def _normalize(name: str) -> str:
    return " ".join(name.strip().lower().split())


def _row_to_observation(row: sqlite3.Row) -> EquipmentObservation:
    created_at = datetime.fromisoformat(row["created_at"])
    duplicates = json.loads(row["possible_duplicate_of"])
    age_days = (datetime.now(timezone.utc) - created_at).total_seconds() / 86400
    # Confidence is re-derived on every read (not trusted from the stored
    # column) so that an observation's confidence reflects how recent it
    # is *right now* -- the same row returned today vs. in 4 months gets a
    # lower confidence if nothing has reconfirmed it since, per the
    # brief's "completitud, antiguedad y confirmaciones independientes".
    confidence = compute_confidence(
        (row["brand"], row["model"], row["approx_age_years"]), len(duplicates), age_days=age_days
    )
    return EquipmentObservation(
        id=row["id"],
        customer=row["customer"],
        city=row["city"],
        country=row["country"],
        modality=row["modality"],
        quantity=row["quantity"],
        brand=row["brand"],
        model=row["model"],
        approx_age_years=row["approx_age_years"],
        estimated_install_year=row["estimated_install_year"],
        confidence=confidence,
        status=ObservationStatus(row["status"]),
        source=row["source"],
        observer=row["observer"],
        visit_date=row["visit_date"],
        notes=row["notes"],
        possible_duplicate_of=duplicates,
        created_at=created_at,
    )


def _row_to_photo(row: sqlite3.Row) -> dict:
    return dict(row)


def compute_confidence(completeness_fields: tuple, duplicate_count: int, age_days: float = 0.0) -> ConfidenceLevel:
    """Combines completeness (how many optional fields are filled), how
    recent the observation is, and independent confirmations (other
    observations already on file for the same customer+modality) instead
    of trusting the raw extraction-time confidence alone.

    `age_days` docks one confidence tier once an observation is older than
    FRESHNESS_THRESHOLD_DAYS without a new confirmation -- called with 0.0
    at insert time (brand new), and recomputed with the real age on every
    read (see `_row_to_observation`), so confidence degrades over time
    instead of being frozen at whatever it was when first saved. Does not
    retroactively bump *other* older observations when a new independent
    one confirms them -- documented simplification."""
    filled = sum(1 for f in completeness_fields if f is not None)
    score = filled + min(duplicate_count, 2)  # cap the confirmation bonus
    if age_days > FRESHNESS_THRESHOLD_DAYS:
        score -= 1
    if score >= 3:
        return ConfidenceLevel.HIGH
    if score >= 1:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW


class Store:
    def __init__(self, db_path: str) -> None:
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    def is_empty(self) -> bool:
        cur = self._conn.execute("SELECT COUNT(*) AS n FROM observations")
        return cur.fetchone()["n"] == 0

    def seed(self, rows: list[dict]) -> None:
        for row in rows:
            self.insert(EquipmentObservation(**row))

    # -- observations ---------------------------------------------------

    def find_possible_duplicates(self, customer: str, modality: str) -> list[int]:
        target = _normalize(customer)
        cur = self._conn.execute(
            "SELECT id, customer FROM observations WHERE modality = ?", (modality,)
        )
        return [r["id"] for r in cur.fetchall() if _normalize(r["customer"]) == target]

    def insert(self, obs: EquipmentObservation) -> EquipmentObservation:
        duplicates = self.find_possible_duplicates(obs.customer, obs.modality)
        confidence = compute_confidence((obs.brand, obs.model, obs.approx_age_years), len(duplicates))
        obs = obs.model_copy(update={"possible_duplicate_of": duplicates, "confidence": confidence})
        cur = self._conn.execute(
            """
            INSERT INTO observations
                (customer, city, country, modality, quantity, brand, model,
                 approx_age_years, estimated_install_year, confidence, status,
                 source, observer, visit_date, notes, possible_duplicate_of, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                obs.customer, obs.city, obs.country, obs.modality, obs.quantity,
                obs.brand, obs.model, obs.approx_age_years, obs.estimated_install_year,
                obs.confidence.value, obs.status.value, obs.source, obs.observer,
                obs.visit_date, obs.notes, json.dumps(obs.possible_duplicate_of),
                obs.created_at.isoformat(),
            ),
        )
        self._conn.commit()
        return obs.model_copy(update={"id": cur.lastrowid})

    def list_all(self) -> list[EquipmentObservation]:
        cur = self._conn.execute("SELECT * FROM observations ORDER BY id")
        return [_row_to_observation(r) for r in cur.fetchall()]

    def list_by_customer(self, customer: str) -> list[EquipmentObservation]:
        target = _normalize(customer)
        return [o for o in self.list_all() if _normalize(o.customer) == target]

    def list_customers_summary(self) -> list[CustomerSummary]:
        by_customer: dict[str, list[EquipmentObservation]] = {}
        for obs in self.list_all():
            by_customer.setdefault(obs.customer, []).append(obs)

        summaries = []
        for customer, obs_list in by_customer.items():
            modalities: dict[str, int] = {}
            for o in obs_list:
                modalities[o.modality] = modalities.get(o.modality, 0) + (o.quantity or 0)
            has_incomplete = any(
                o.status in (ObservationStatus.ESTIMATED, ObservationStatus.UNKNOWN)
                or o.brand is None
                or o.approx_age_years is None
                for o in obs_list
            )
            summaries.append(
                CustomerSummary(
                    customer=customer,
                    country=obs_list[0].country,
                    city=obs_list[0].city,
                    equipment_count=sum(o.quantity or 0 for o in obs_list),
                    modalities=modalities,
                    last_updated=max(o.created_at for o in obs_list),
                    has_incomplete_info=has_incomplete,
                )
            )
        return sorted(summaries, key=lambda s: s.customer)

    def compute_analytics(self) -> AnalyticsSummary:
        all_obs = self.list_all()
        if not all_obs:
            return AnalyticsSummary(total_observations=0)

        by_modality: dict[str, int] = {}
        by_country: dict[str, int] = {}
        by_status: dict[str, int] = {}
        ages: list[float] = []
        aging_customers: set[str] = set()
        incomplete_customers: set[str] = set()
        aging_ages: dict[str, list[float]] = {}
        aging_modalities: dict[str, set[str]] = {}
        last_seen: dict[str, datetime] = {}

        for o in all_obs:
            by_modality[o.modality] = by_modality.get(o.modality, 0) + (o.quantity or 0)
            if o.country:
                by_country[o.country] = by_country.get(o.country, 0) + (o.quantity or 0)
            by_status[o.status.value] = by_status.get(o.status.value, 0) + 1
            last_seen[o.customer] = max(last_seen.get(o.customer, o.created_at), o.created_at)
            if o.approx_age_years is not None:
                ages.append(o.approx_age_years)
                if o.approx_age_years >= AGING_THRESHOLD_YEARS:
                    aging_customers.add(o.customer)
                    aging_ages.setdefault(o.customer, []).append(o.approx_age_years)
                    aging_modalities.setdefault(o.customer, set()).add(o.modality)
            if o.status in (ObservationStatus.ESTIMATED, ObservationStatus.UNKNOWN) or o.brand is None:
                incomplete_customers.add(o.customer)

        now = datetime.now(timezone.utc)
        stale_customers = sorted(
            c for c, ts in last_seen.items() if (now - ts) > timedelta(days=FRESHNESS_THRESHOLD_DAYS)
        )

        refresh_opportunities = [
            RefreshOpportunity(
                customer=customer,
                reason=(
                    f"{len(aging_ages[customer])} equipo(s) con {round(sum(aging_ages[customer]) / len(aging_ages[customer]), 1)} "
                    f"anios promedio en {', '.join(sorted(aging_modalities[customer]))}"
                ),
            )
            for customer in sorted(aging_customers)
        ]

        return AnalyticsSummary(
            total_observations=len(all_obs),
            by_modality=by_modality,
            by_country=by_country,
            by_status=by_status,
            average_age_years=round(sum(ages) / len(ages), 1) if ages else None,
            aging_customers=sorted(aging_customers),
            incomplete_customers=sorted(incomplete_customers),
            stale_customers=stale_customers,
            refresh_opportunities=refresh_opportunities,
        )

    # -- photo queue ------------------------------------------------------

    def insert_photo(self, photo_path: str, customer: str | None, technician_id: str | None) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        cur = self._conn.execute(
            """
            INSERT INTO photo_queue (photo_path, customer, technician_id, status, created_at)
            VALUES (?, ?, ?, 'pending', ?)
            """,
            (photo_path, customer, technician_id, now),
        )
        self._conn.commit()
        return self.get_photo(cur.lastrowid)

    def get_photo(self, photo_id: int) -> dict | None:
        cur = self._conn.execute("SELECT * FROM photo_queue WHERE id = ?", (photo_id,))
        row = cur.fetchone()
        return _row_to_photo(row) if row else None

    def list_photos(self, status: str | None = None) -> list[dict]:
        if status:
            cur = self._conn.execute("SELECT * FROM photo_queue WHERE status = ? ORDER BY id", (status,))
        else:
            cur = self._conn.execute("SELECT * FROM photo_queue ORDER BY id")
        return [_row_to_photo(r) for r in cur.fetchall()]

    def next_pending_photo(self) -> dict | None:
        cur = self._conn.execute("SELECT * FROM photo_queue WHERE status = 'pending' ORDER BY id LIMIT 1")
        row = cur.fetchone()
        return _row_to_photo(row) if row else None

    def mark_photo_needs_review(self, photo_id: int, modality: str | None, brand: str | None, model: str | None, confidence: str | None) -> None:
        self._conn.execute(
            """
            UPDATE photo_queue
            SET status = 'needs_review', guessed_modality = ?, guessed_brand = ?,
                guessed_model = ?, guessed_confidence = ?, processed_at = ?
            WHERE id = ?
            """,
            (modality, brand, model, confidence, datetime.now(timezone.utc).isoformat(), photo_id),
        )
        self._conn.commit()

    def mark_photo_failed(self, photo_id: int) -> None:
        self._conn.execute(
            "UPDATE photo_queue SET status = 'failed', processed_at = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), photo_id),
        )
        self._conn.commit()

    def resolve_photo(self, photo_id: int, confirmed: bool, corrected_label: str | None, linked_observation_id: int) -> None:
        self._conn.execute(
            """
            UPDATE photo_queue
            SET status = ?, corrected_label = ?, linked_observation_id = ?
            WHERE id = ?
            """,
            ("confirmed" if confirmed else "rejected", corrected_label, linked_observation_id, photo_id),
        )
        self._conn.commit()

    # -- idempotency ------------------------------------------------------

    def get_cached_response(self, client_event_id: str) -> dict | None:
        cur = self._conn.execute(
            "SELECT response_json FROM processed_events WHERE client_event_id = ?", (client_event_id,)
        )
        row = cur.fetchone()
        return json.loads(row["response_json"]) if row else None

    def cache_response(self, client_event_id: str, response: dict) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO processed_events (client_event_id, response_json, created_at) VALUES (?, ?, ?)",
            (client_event_id, json.dumps(response), datetime.now(timezone.utc).isoformat()),
        )
        self._conn.commit()
