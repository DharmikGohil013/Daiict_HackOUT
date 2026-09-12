"""Plants, institutions, generation, weather, predictions, transactions."""

from modules import registry


def test_plant_upsert_and_query():
    p = registry.upsert_plant(
        {
            "plant_id": "GEN-1",
            "name": "A",
            "energy_type": "Solar",
            "capacity_mw": 5,
            "location": "Bhuj, Gujarat",
            "state": "Gujarat",
        }
    )
    assert p["status"] == "active" and p["registered_at"]
    registry.upsert_plant(
        {
            "plant_id": "GEN-1",
            "name": "A2",
            "energy_type": "Solar",
            "capacity_mw": 6,
            "location": "Bhuj",
            "state": "Gujarat",
        }
    )
    assert registry.get_plant("GEN-1")["capacity_mw"] == 6 and registry.get_plant("GEN-1")["name"] == "A2"
    registry.upsert_plant(
        {
            "plant_id": "GEN-2",
            "name": "W",
            "energy_type": "Wind",
            "capacity_mw": 25,
            "location": "Jaisalmer",
            "state": "Rajasthan",
        }
    )
    assert [p["plant_id"] for p in registry.list_plants(energy_type="Wind")] == ["GEN-2"]
    assert len(registry.list_plants(search="jais")) == 1
    assert (
        registry.set_plant_status("GEN-2", "under_review") and registry.get_plant("GEN-2")["status"] == "under_review"
    )
    assert registry.get_plant("NOPE") is None


def test_institutions():
    registry.upsert_institution({"institution_id": "INST-1", "name": "Acme", "sector": "Steel"})
    assert registry.get_institution("INST-1")["sector"] == "Steel"
    assert registry.list_institutions(search="acm")[0]["institution_id"] == "INST-1"


def test_generation_upsert_sum_and_stats():
    registry.upsert_plant({"plant_id": "GEN-1", "name": "A", "energy_type": "Solar", "capacity_mw": 5, "location": "x"})
    for i, kwh in enumerate([100, 200, 300]):
        registry.upsert_generation("GEN-1", f"2026-08-0{i + 1}", kwh, source="csv", submitted_by="ops")
    registry.upsert_generation("GEN-1", "2026-08-01", 150)  # overwrite same day
    assert registry.sum_generation("GEN-1", "2026-08-01", "2026-08-03") == 650
    assert registry.sum_generation("GEN-1", "2026-09-01", "2026-09-03") is None
    stats = registry.generation_stats("GEN-1")
    assert stats["days"] == 3 and stats["total_kwh"] == 650 and stats["first_date"] == "2026-08-01"
    assert registry.monthly_generation("GEN-1") == [{"month": "2026-08", "kwh": 650.0, "plants": 1}]
    assert len(registry.get_generation("GEN-1", start="2026-08-02")) == 2


def test_weather_roundtrip():
    w = {
        "temperature_c": 30,
        "humidity_pct": 60,
        "cloud_cover_pct": 20,
        "solar_irradiance_kwh_m2": 5.5,
        "wind_speed_ms": 4,
    }
    registry.upsert_weather("GEN-1", "2026-08-01", w)
    assert registry.get_weather("GEN-1", "2026-08-01") == {k: float(v) for k, v in w.items()}
    assert registry.get_weather("GEN-1", "2026-08-02") is None
    assert len(registry.get_weather_series("GEN-1")) == 1


def test_predictions_latest_per_date():
    registry.insert_prediction("GEN-1", "2026-08-01", 100, 90, 110, "rf-v1")
    registry.insert_prediction("GEN-1", "2026-08-01", 120, 100, 140, "rf-v1")
    registry.insert_prediction("GEN-1", "2026-08-02", 130, 120, 140, "rf-v1", horizon_hours=24)
    latest = registry.latest_predictions("GEN-1")
    assert [p["predicted_kwh"] for p in latest] == [120, 130]


def test_transactions():
    t = registry.upsert_transaction(
        {
            "transaction_id": "TXN-1",
            "cert_id": "REC-1",
            "seller_plant_id": "GEN-1",
            "buyer_institution_id": "INST-1",
            "energy_kwh": 100,
        }
    )
    assert t["created_at"]
    assert registry.list_transactions(institution_id="INST-1")[0]["transaction_id"] == "TXN-1"
    assert registry.list_transactions(plant_id="NOPE") == []
    assert registry.counts()["transactions"] == 1
