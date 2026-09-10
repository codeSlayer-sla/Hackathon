from datetime import datetime, timedelta, timezone

from qvac_mesh_shared import ConfidenceLevel, EquipmentObservation, ObservationStatus

from app.store import Store, compute_confidence


def _obs(**overrides) -> EquipmentObservation:
    defaults = dict(
        customer="Hospital Alpha",
        city="City",
        country="Country",
        modality="MR",
        quantity=2,
        confidence=ConfidenceLevel.HIGH,
        status=ObservationStatus.REPORTED,
    )
    defaults.update(overrides)
    return EquipmentObservation(**defaults)


def test_insert_assigns_incrementing_id():
    store = Store(":memory:")
    first = store.insert(_obs())
    second = store.insert(_obs())
    assert first.id == 1
    assert second.id == 2


def test_duplicate_detection_same_customer_and_modality():
    store = Store(":memory:")
    store.insert(_obs())
    second = store.insert(_obs(quantity=1))
    assert second.possible_duplicate_of == [1]


def test_duplicate_detection_normalizes_customer_name():
    store = Store(":memory:")
    store.insert(_obs(customer="  Hospital Alpha  "))
    second = store.insert(_obs(customer="hospital alpha"))
    assert second.possible_duplicate_of == [1]


def test_no_duplicate_for_different_modality():
    store = Store(":memory:")
    store.insert(_obs(modality="MR"))
    second = store.insert(_obs(modality="CT"))
    assert second.possible_duplicate_of == []


def test_list_by_customer_is_case_insensitive():
    store = Store(":memory:")
    store.insert(_obs(customer="Hospital Alpha"))
    assert len(store.list_by_customer("HOSPITAL ALPHA")) == 1


def test_customers_summary_aggregates_modalities():
    store = Store(":memory:")
    store.insert(_obs(modality="MR", quantity=2))
    store.insert(_obs(modality="CT", quantity=1))
    summaries = store.list_customers_summary()
    assert len(summaries) == 1
    assert summaries[0].equipment_count == 3
    assert summaries[0].modalities == {"MR": 2, "CT": 1}


def test_analytics_flags_aging_and_incomplete_customers():
    store = Store(":memory:")
    store.insert(_obs(approx_age_years=10, status=ObservationStatus.REPORTED, brand="Acme"))
    store.insert(
        _obs(
            customer="Hospital Beta",
            approx_age_years=2,
            status=ObservationStatus.ESTIMATED,
            brand=None,
        )
    )
    analytics = store.compute_analytics()
    assert analytics.total_observations == 2
    assert "Hospital Alpha" in analytics.aging_customers
    assert "Hospital Beta" in analytics.incomplete_customers
    assert "Hospital Beta" not in analytics.aging_customers


def test_analytics_on_empty_store():
    store = Store(":memory:")
    analytics = store.compute_analytics()
    assert analytics.total_observations == 0
    assert analytics.average_age_years is None


def test_analytics_flags_stale_customers():
    store = Store(":memory:")
    old = _obs(customer="Hospital Stale")
    old = old.model_copy(update={"created_at": datetime.now(timezone.utc) - timedelta(days=200)})
    store.insert(old)
    store.insert(_obs(customer="Hospital Fresh"))
    analytics = store.compute_analytics()
    assert "Hospital Stale" in analytics.stale_customers
    assert "Hospital Fresh" not in analytics.stale_customers


def test_analytics_refresh_opportunities_reflect_aging_customers():
    store = Store(":memory:")
    store.insert(_obs(customer="Hospital Old", modality="CT", approx_age_years=12))
    analytics = store.compute_analytics()
    assert len(analytics.refresh_opportunities) == 1
    assert analytics.refresh_opportunities[0].customer == "Hospital Old"
    assert "CT" in analytics.refresh_opportunities[0].reason


def test_analytics_groups_by_technician_and_country():
    store = Store(":memory:")
    store.insert(_obs(customer="Hospital Alpha", country="Panama", observer="Field User 01"))
    store.insert(_obs(customer="Hospital Beta", country="Panama", observer="Field User 01"))
    store.insert(_obs(customer="Hospital Gamma", country="Colombia", observer="Sales User 02"))
    store.insert(_obs(customer="Hospital Delta", country=None, observer=None))
    analytics = store.compute_analytics()
    assert analytics.by_technician == {"Field User 01": 2, "Sales User 02": 1}
    assert analytics.by_technician_country == {
        "Field User 01": {"Panama": 2},
        "Sales User 02": {"Colombia": 1},
    }


def test_list_technicians_with_activity_includes_observation_count():
    store = Store(":memory:")
    store.insert_technician("tech-01", "Field User 01", "hash-1")
    store.insert(_obs(observer="Field User 01"))
    store.insert(_obs(observer="Field User 01", customer="Hospital Beta"))
    rows = store.list_technicians_with_activity()
    assert len(rows) == 1
    assert rows[0]["observation_count"] == 2
    assert rows[0]["last_extract_at"] is None


def test_touch_technician_last_extract_sets_timestamp():
    store = Store(":memory:")
    store.insert_technician("tech-01", "Field User 01", "hash-1")
    store.touch_technician_last_extract("tech-01")
    rows = store.list_technicians_with_activity()
    assert rows[0]["last_extract_at"] is not None


# -- compute_confidence -------------------------------------------------


def test_compute_confidence_low_when_nothing_filled_and_no_duplicates():
    assert compute_confidence((None, None, None), duplicate_count=0) == ConfidenceLevel.LOW


def test_compute_confidence_medium_with_partial_completeness():
    assert compute_confidence(("NovaMed", None, None), duplicate_count=0) == ConfidenceLevel.MEDIUM


def test_compute_confidence_high_with_full_completeness():
    assert compute_confidence(("NovaMed", "NM-MR700", 7.0), duplicate_count=0) == ConfidenceLevel.HIGH


def test_compute_confidence_downgraded_by_age():
    fresh = compute_confidence(("NovaMed", "NM-MR700", 7.0), duplicate_count=0, age_days=0)
    stale = compute_confidence(("NovaMed", "NM-MR700", 7.0), duplicate_count=0, age_days=200)
    assert fresh == ConfidenceLevel.HIGH
    assert stale == ConfidenceLevel.MEDIUM


def test_confidence_decays_when_read_long_after_creation():
    store = Store(":memory:")
    saved = store.insert(_obs(brand="NovaMed", model="NM-MR700", approx_age_years=7))
    assert saved.confidence == ConfidenceLevel.HIGH  # brand new, full completeness

    old_created_at = (datetime.now(timezone.utc) - timedelta(days=200)).isoformat()
    store._conn.execute("UPDATE observations SET created_at = ? WHERE id = ?", (old_created_at, saved.id))
    store._conn.commit()

    reloaded = store.list_all()[0]
    assert reloaded.confidence == ConfidenceLevel.MEDIUM  # same data, but stale now


def test_compute_confidence_boosted_by_independent_confirmations():
    # No completeness at all, but two independent prior reports -> boosted
    # from LOW into MEDIUM.
    assert compute_confidence((None, None, None), duplicate_count=2) == ConfidenceLevel.MEDIUM
    # Some completeness AND independent confirmations -> HIGH.
    assert compute_confidence(("NovaMed", None, None), duplicate_count=2) == ConfidenceLevel.HIGH


def test_insert_overwrites_raw_confidence_with_computed_one():
    store = Store(":memory:")
    # Explicit HIGH confidence in the input, but no brand/model/age and no
    # prior duplicates -> the store should compute LOW, not trust the input.
    obs = store.insert(_obs(confidence=ConfidenceLevel.HIGH, brand=None))
    assert obs.confidence == ConfidenceLevel.LOW


# -- photo queue ----------------------------------------------------------


def test_photo_queue_lifecycle():
    store = Store(":memory:")
    photo = store.insert_photo("/data/media/photos/a.jpg", customer="Hospital Alpha", technician_id="tech-01")
    assert photo["status"] == "pending"

    pending = store.next_pending_photo()
    assert pending["id"] == photo["id"]

    store.mark_photo_needs_review(photo["id"], "MR", "NovaMed", "NM-MR700", "high")
    updated = store.get_photo(photo["id"])
    assert updated["status"] == "needs_review"
    assert updated["guessed_modality"] == "MR"

    assert store.next_pending_photo() is None  # no more pending

    store.resolve_photo(photo["id"], confirmed=True, corrected_label=None, linked_observation_id=42)
    resolved = store.get_photo(photo["id"])
    assert resolved["status"] == "confirmed"
    assert resolved["linked_observation_id"] == 42


def test_photo_queue_failed_status():
    store = Store(":memory:")
    photo = store.insert_photo("/data/media/photos/a.jpg", customer=None, technician_id="tech-01")
    store.mark_photo_failed(photo["id"])
    assert store.get_photo(photo["id"])["status"] == "failed"


def test_list_photos_filters_by_status():
    store = Store(":memory:")
    p1 = store.insert_photo("/a.jpg", "Hospital Alpha", "tech-01")
    store.insert_photo("/b.jpg", "Hospital Beta", "tech-01")
    store.mark_photo_needs_review(p1["id"], "MR", None, None, "medium")
    assert len(store.list_photos(status="needs_review")) == 1
    assert len(store.list_photos(status="pending")) == 1
    assert len(store.list_photos()) == 2


# -- idempotency ------------------------------------------------------


def test_idempotency_cache_roundtrip():
    store = Store(":memory:")
    assert store.get_cached_response("evt-1") is None
    store.cache_response("evt-1", {"agent_message": "hola"})
    assert store.get_cached_response("evt-1") == {"agent_message": "hola"}
