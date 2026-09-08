from qvac_mesh_shared import ConfidenceLevel, EquipmentObservation, ObservationStatus

from app.store import Store


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
