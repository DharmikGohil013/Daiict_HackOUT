"""
Feature engineering shared by training, prediction and forecasting.

The model predicts *specific yield* (kWh per kW of installed capacity per day, i.e. daily
full-load hours) rather than absolute kWh, so plants from 2 MW to 100 MW share one
weather→output relationship; callers multiply by capacity.
"""

from datetime import date
from typing import Dict

from modules.ml.synthetic import ENERGY_TYPE_CODE

FEATURE_COLUMNS = [
    "capacity_mw",
    "energy_type_code",
    "latitude",
    "longitude",
    "month",
    "day_of_year",
    "hour",
    "temperature_c",
    "humidity_pct",
    "cloud_cover_pct",
    "solar_irradiance_kwh_m2",
    "wind_speed_ms",
    "historical_yield_kwh_per_kw",
]


def build_feature_row(
    plant: Dict, weather: Dict[str, float], day: date, historical_generation_kwh: float, hour: int = 12
) -> Dict:
    return {
        "capacity_mw": float(plant["capacity_mw"]),
        "energy_type_code": ENERGY_TYPE_CODE.get(plant.get("energy_type", "Other"), 4),
        "latitude": float(plant.get("latitude") or 0.0),
        "longitude": float(plant.get("longitude") or 0.0),
        "month": day.month,
        "day_of_year": day.timetuple().tm_yday,
        "hour": hour,
        "temperature_c": float(weather.get("temperature_c") or 0.0),
        "humidity_pct": float(weather.get("humidity_pct") or 0.0),
        "cloud_cover_pct": float(weather.get("cloud_cover_pct") or 0.0),
        "solar_irradiance_kwh_m2": float(weather.get("solar_irradiance_kwh_m2") or 0.0),
        "wind_speed_ms": float(weather.get("wind_speed_ms") or 0.0),
        "historical_yield_kwh_per_kw": float(historical_generation_kwh or 0.0)
        / max(float(plant["capacity_mw"]) * 1000.0, 1.0),
    }
