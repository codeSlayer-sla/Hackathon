"""SQLite persistence for installed-base observations.

Plain stdlib sqlite3, no ORM -- the schema is one flat table and the MVP
doesn't need more than that. Duplicate detection is a simple heuristic
(normalized customer name + same modality), not semantic matching; good
enough to flag "hey, check this" without blocking the save.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone

from qvac_mesh_shared import AnalyticsSummary, ConfidenceLevel, CustomerSummary, EquipmentObservation, ObservationStatus

AGING_THRESHOLD_YEARS = 8

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
)
"""


def _normalize(name: str) -> str:
    return " ".join(name.strip().lower().split())


def _row_to_observation(row: sqlite3.Row) -> EquipmentObservation:
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
        confidence=ConfidenceLevel(row["confidence"]),
        status=ObservationStatus(row["status"]),
        source=row["source"],
        observer=row["observer"],
        visit_date=row["visit_date"],
        notes=row["notes"],
        possible_duplicate_of=json.loads(row["possible_duplicate_of"]),
        created_at=datetime.fromisoformat(row["created_at"]),
    )


class Store:
    def __init__(self, db_path: str) -> None:
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute(_SCHEMA)
        self._conn.commit()

    def is_empty(self) -> bool:
        cur = self._conn.execute("SELECT COUNT(*) AS n FROM observations")
        return cur.fetchone()["n"] == 0

    def seed(self, rows: list[dict]) -> None:
        for row in rows:
            self.insert(EquipmentObservation(**row))

    def find_possible_duplicates(self, customer: str, modality: str) -> list[int]:
        target = _normalize(customer)
        cur = self._conn.execute(
            "SELECT id, customer FROM observations WHERE modality = ?", (modality,)
        )
        return [r["id"] for r in cur.fetchall() if _normalize(r["customer"]) == target]

    def insert(self, obs: EquipmentObservation) -> EquipmentObservation:
        duplicates = self.find_possible_duplicates(obs.customer, obs.modality)
        obs = obs.model_copy(update={"possible_duplicate_of": duplicates})
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

        for o in all_obs:
            by_modality[o.modality] = by_modality.get(o.modality, 0) + (o.quantity or 0)
            if o.country:
                by_country[o.country] = by_country.get(o.country, 0) + (o.quantity or 0)
            by_status[o.status.value] = by_status.get(o.status.value, 0) + 1
            if o.approx_age_years is not None:
                ages.append(o.approx_age_years)
                if o.approx_age_years >= AGING_THRESHOLD_YEARS:
                    aging_customers.add(o.customer)
            if o.status in (ObservationStatus.ESTIMATED, ObservationStatus.UNKNOWN) or o.brand is None:
                incomplete_customers.add(o.customer)

        return AnalyticsSummary(
            total_observations=len(all_obs),
            by_modality=by_modality,
            by_country=by_country,
            by_status=by_status,
            average_age_years=round(sum(ages) / len(ages), 1) if ages else None,
            aging_customers=sorted(aging_customers),
            incomplete_customers=sorted(incomplete_customers),
        )
