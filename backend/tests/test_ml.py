"""Generation model + prediction service."""

from datetime import date, timedelta

import pytest

from modules import registry
from modules.ml import anomaly_score, forecast, get_model, predict_daily, predict_period
from modules.ml.features import FEATURE_COLUMNS, build_feature_row
from modules.ml.model import GenerationModel, MODEL_VERSION
from modules.ml.synthetic import generate_training_frame, physical_generation_kwh, seasonal_weather

PLANT = {
    "plant_id": "GEN-T1",
    "name": "Test Solar",
    "energy_type": "Solar",
    "capacity_mw": 5.0,
    "location": "Bhuj",
    "state": "Gujarat",
    "latitude": 23.24,
    "longitude": 69.67,
}


@pytest.fixture
def plant():
    return registry.upsert_plant(PLANT)


def test_training_frame_shape():
    df = generate_training_frame(n_plants=4, days=40, seed=1)
    assert list(df.columns) == FEATURE_COLUMNS + ["generation_kwh"]
    assert len(df) == 160
    assert (df["generation_kwh"] >= 0).all()


def test_physics_is_directionally_right():
    hot_clear = {
        "temperature_c": 30,
        "humidity_pct": 40,
        "cloud_cover_pct": 10,
        "solar_irradiance_kwh_m2": 6.5,
        "wind_speed_ms": 4,
    }
    overcast = {**hot_clear, "solar_irradiance_kwh_m2": 2.0, "cloud_cover_pct": 90}
    assert physical_generation_kwh("Solar", 5, hot_clear) > physical_generation_kwh("Solar", 5, overcast)
    assert physical_generation_kwh("Wind", 10, {**hot_clear, "wind_speed_ms": 2.0}) == 0.0
    assert physical_generation_kwh("Wind", 10, {**hot_clear, "wind_speed_ms": 12.0}) > physical_generation_kwh(
        "Wind", 10, {**hot_clear, "wind_speed_ms": 6.0}
    )
    assert physical_generation_kwh("Wind", 10, {**hot_clear, "wind_speed_ms": 26.0}) == 0.0  # cut-out
    # 5 MW solar on a clear 6.5 kWh/m² day ≈ 20–26 MWh
    assert 18_000 < physical_generation_kwh("Solar", 5, hot_clear) < 27_000


def test_seasonal_weather_is_deterministic_and_bounded():
    a = seasonal_weather(23.2, 69.7, date(2026, 8, 10))
    b = seasonal_weather(23.2, 69.7, date(2026, 8, 10))
    assert a == b
    assert (
        0 <= a["cloud_cover_pct"] <= 100
        and 0.5 <= a["wind_speed_ms"] <= 25
        and 0.8 <= a["solar_irradiance_kwh_m2"] <= 7.5
    )


def test_model_trains_and_generalises():
    m = get_model()
    assert m.version == MODEL_VERSION
    assert m.metrics["r2"] > 0.85, m.metrics
    info = m.info()
    assert info["features"] == FEATURE_COLUMNS and sum(info["feature_importance"].values()) == pytest.approx(
        1.0, abs=0.01
    )


def test_predict_returns_ordered_interval():
    m = get_model()
    w = seasonal_weather(23.2, 69.7, date(2026, 8, 10))
    pred, lo, hi = m.predict([build_feature_row(PLANT, w, date(2026, 8, 10), 16_000)])[0]
    assert lo <= pred <= hi
    assert 8_000 < pred < 25_000


def test_more_irradiance_means_more_solar():
    m = get_model()
    base = seasonal_weather(23.2, 69.7, date(2026, 8, 10))
    low = {**base, "solar_irradiance_kwh_m2": 2.0, "cloud_cover_pct": 90}
    high = {**base, "solar_irradiance_kwh_m2": 6.8, "cloud_cover_pct": 5}
    p_low = m.predict([build_feature_row(PLANT, low, date(2026, 8, 10), 16_000)])[0][0]
    p_high = m.predict([build_feature_row(PLANT, high, date(2026, 8, 10), 16_000)])[0][0]
    assert p_high > p_low


def test_model_save_and_load(tmp_path):
    m = get_model()
    path = m.save(str(tmp_path / "m.pkl"))
    loaded = GenerationModel.load(path)
    assert loaded is not None and loaded.metrics == m.metrics
    assert GenerationModel.load(str(tmp_path / "missing.pkl")) is None


def test_predict_daily_persists_weather_and_prediction(plant):
    r = predict_daily(plant, "2026-08-10")
    assert r["predicted_kwh"] > 0 and r["model_version"] == MODEL_VERSION
    assert registry.get_weather("GEN-T1", "2026-08-10") is not None
    assert registry.latest_predictions("GEN-T1", "2026-08-10", "2026-08-10")[0]["predicted_kwh"] == r["predicted_kwh"]


def test_predict_period_sums_days_and_uses_history(plant):
    for i in range(30):
        d = date(2026, 7, 1) + timedelta(days=i)
        registry.upsert_generation("GEN-T1", d.isoformat(), 16_000 + (i % 5) * 200, source="seed")
    r = predict_period("GEN-T1", "2026-08-01", "2026-08-31")
    assert r["days"] == 31 and len(r["daily"]) == 31
    assert r["expected_kwh"] == pytest.approx(sum(x["predicted_kwh"] for x in r["daily"]), abs=1)
    assert r["lower_bound_kwh"] <= r["expected_kwh"] <= r["upper_bound_kwh"]
    assert r["capacity_max_kwh"] == 5 * 1000 * 24 * 31
    assert 300_000 < r["expected_kwh"] < 700_000  # 5 MW solar month ≈ 0.4–0.6 GWh
    assert r["historical_expected_kwh"] > 0


def test_predict_period_validation(plant):
    with pytest.raises(ValueError):
        predict_period("NOPE", "2026-08-01", "2026-08-02")
    with pytest.raises(ValueError):
        predict_period("GEN-T1", "2026-08-05", "2026-08-01")


def test_forecast_horizons(plant):
    f = forecast("GEN-T1")
    assert [x["horizon_hours"] for x in f] == [24, 48, 72]
    assert all(x["lower_bound_kwh"] <= x["predicted_kwh"] <= x["upper_bound_kwh"] for x in f)


def test_anomaly_score_levels():
    assert anomaly_score(890_000, 620_000, 600_000, 650_000)["level"] == "HIGH"
    assert anomaly_score(700_000, 620_000)["level"] == "LOW" or anomaly_score(700_000, 620_000)["level"] == "MEDIUM"
    assert anomaly_score(620_000, 620_000)["deviation_pct"] == 0.0
    assert anomaly_score(890_000, 620_000, 600_000, 650_000)["outside_interval"] is True
