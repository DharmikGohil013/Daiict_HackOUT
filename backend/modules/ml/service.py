"""
Prediction service — the interface the rest of the backend (and later a FastAPI
service) exposes:

    predict_daily(plant, day)                 → expected kWh for one day (+ bounds)
    predict_period(plant_id, start, end)      → expected kWh over a claim period
    forecast(plant_id, horizons)              → next 24 / 48 / 72 h
    anomaly_score(claimed, expected, lo, hi)  → deviation + level
"""

from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Sequence

import numpy as np
import structlog

from modules import registry
from modules.ml.features import build_feature_row
from modules.ml.model import MODEL_VERSION, get_model
from modules.ml.synthetic import physical_generation_kwh, seasonal_weather

log = structlog.get_logger()


def _to_date(value) -> date:
    if isinstance(value, date):
        return value
    return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_or_synthesize_weather(plant: Dict, day: date, persist: bool = True) -> Dict[str, float]:
    """Stored observation if present, else a deterministic seasonal estimate (persisted for consistency)."""
    row = registry.get_weather(plant["plant_id"], day.isoformat())
    if row:
        return row
    w = seasonal_weather(float(plant.get("latitude") or 22.0), float(plant.get("longitude") or 72.0), day)
    if persist:
        registry.upsert_weather(plant["plant_id"], day.isoformat(), w)
    return w


def historical_daily_mean(plant: Dict, before: date, days: int = 30) -> float:
    """Mean metered daily generation over the previous *days*; physics estimate when no data exists."""
    rows = registry.get_generation(
        plant["plant_id"],
        start=(before - timedelta(days=days)).isoformat(),
        end=(before - timedelta(days=1)).isoformat(),
    )
    daily = [r["generation_kwh"] for r in rows if r.get("hour") is None]
    if daily:
        return float(np.mean(daily))
    # cold start: typical-weather physics estimate
    typical = seasonal_weather(float(plant.get("latitude") or 22.0), float(plant.get("longitude") or 72.0), before)
    return physical_generation_kwh(plant["energy_type"], plant["capacity_mw"], typical)


def predict_daily(plant: Dict, day, persist: bool = True, horizon_hours: Optional[int] = None) -> Dict:
    day = _to_date(day)
    weather = get_or_synthesize_weather(plant, day, persist=persist)
    hist = historical_daily_mean(plant, day)
    row = build_feature_row(plant, weather, day, hist)
    pred, lo, hi = get_model().predict([row])[0]
    result = {
        "plant_id": plant["plant_id"],
        "target_date": day.isoformat(),
        "predicted_kwh": pred,
        "lower_bound_kwh": lo,
        "upper_bound_kwh": hi,
        "model_version": MODEL_VERSION,
        "weather": weather,
        "historical_daily_mean_kwh": round(hist, 1),
        "features": row,
    }
    if persist:
        registry.insert_prediction(
            plant["plant_id"], day.isoformat(), pred, lo, hi, MODEL_VERSION, row, horizon_hours=horizon_hours
        )
    return result


def predict_period(plant_id: str, start, end, persist: bool = True) -> Dict:
    """Expected generation over [start, end] inclusive — one batched model call for all days."""
    plant = registry.get_plant(plant_id)
    if not plant:
        raise ValueError(f"Unknown plant {plant_id}")
    start, end = _to_date(start), _to_date(end)
    if end < start:
        raise ValueError("period_end before period_start")
    dates, rows, weathers, hists = [], [], [], []
    d = start
    while d <= end:
        weather = get_or_synthesize_weather(plant, d, persist=persist)
        hist = historical_daily_mean(plant, d)
        dates.append(d)
        weathers.append(weather)
        hists.append(hist)
        rows.append(build_feature_row(plant, weather, d, hist))
        d += timedelta(days=1)
    preds = get_model().predict(rows)
    daily = []
    for day, (pred, lo, hi), row in zip(dates, preds, rows):
        daily.append({"date": day.isoformat(), "predicted_kwh": pred, "lower": lo, "upper": hi})
        if persist:
            registry.insert_prediction(plant_id, day.isoformat(), pred, lo, hi, MODEL_VERSION, row)
    expected = round(sum(x["predicted_kwh"] for x in daily), 1)
    lo_sum = round(sum(x["lower"] for x in daily), 1)
    hi_sum = round(sum(x["upper"] for x in daily), 1)
    weather_avg = {
        k: round(float(np.mean([w[k] for w in weathers])), 2)
        for k in ("temperature_c", "humidity_pct", "cloud_cover_pct", "solar_irradiance_kwh_m2", "wind_speed_ms")
    }
    hist_mean = float(np.mean(hists))
    return {
        "plant_id": plant_id,
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "days": len(daily),
        "expected_kwh": expected,
        "lower_bound_kwh": lo_sum,
        "upper_bound_kwh": hi_sum,
        "historical_expected_kwh": round(hist_mean * len(daily), 1),
        "capacity_max_kwh": round(plant["capacity_mw"] * 1000 * 24 * len(daily), 1),
        "weather_avg": weather_avg,
        "model_version": MODEL_VERSION,
        "daily": daily,
    }


def forecast(plant_id: str, horizons: Sequence[int] = (24, 48, 72), persist: bool = True) -> List[Dict]:
    """Forecast for the next N hours (each horizon = one target day ahead)."""
    plant = registry.get_plant(plant_id)
    if not plant:
        raise ValueError(f"Unknown plant {plant_id}")
    today = date.today()
    out = []
    for h in horizons:
        target = today + timedelta(days=max(1, int(round(h / 24))))
        p = predict_daily(plant, target, persist=persist, horizon_hours=int(h))
        out.append(
            {
                "horizon_hours": int(h),
                "target_date": target.isoformat(),
                "predicted_kwh": p["predicted_kwh"],
                "lower_bound_kwh": p["lower_bound_kwh"],
                "upper_bound_kwh": p["upper_bound_kwh"],
                "weather": p["weather"],
            }
        )
    return out


def anomaly_score(
    claimed_kwh: float, expected_kwh: float, lower_kwh: Optional[float] = None, upper_kwh: Optional[float] = None
) -> Dict:
    expected = max(float(expected_kwh), 1.0)
    dev = (float(claimed_kwh) - expected) / expected * 100.0
    spread = max((float(upper_kwh or expected * 1.1) - float(lower_kwh or expected * 0.9)) / 2.0, expected * 0.05)
    z = (float(claimed_kwh) - expected) / spread
    if dev > 40:
        level = "HIGH"
    elif dev > 15:
        level = "MEDIUM"
    elif dev < -40:
        level = "MEDIUM"  # under-reporting is also worth a look
    else:
        level = "LOW"
    return {
        "deviation_pct": round(dev, 1),
        "z_score": round(z, 2),
        "level": level,
        "outside_interval": bool(upper_kwh and claimed_kwh > upper_kwh),
    }
