"""
Synthetic weather + generation physics used to train the MVP model and to seed demo data.

The generator is deterministic for a given seed. Formulas are deliberately simple but
directionally right for Indian sites: irradiance peaks around late April, the south-west
monsoon (Jun–Sep) brings cloud, humidity and stronger wind, and each technology converts
weather into energy with its own capacity-factor curve.
"""

import math
from datetime import date, timedelta
from typing import Dict, Optional

import numpy as np

ENERGY_TYPE_CODE = {"Solar": 0, "Wind": 1, "Hydro": 2, "Biomass": 3, "Other": 4}

SOLAR_PERFORMANCE_RATIO = 0.78
WIND_AVAILABILITY = 0.95


def _rng(seed) -> np.random.Generator:
    return np.random.default_rng(seed)


def _monsoon_factor(doy: int) -> float:
    """0..1 bell centred on mid-August (day ~227), width ~45 days."""
    return math.exp(-(((doy - 227) / 45.0) ** 2))


def seasonal_weather(
    latitude: float, longitude: float, day: date, rng: Optional[np.random.Generator] = None
) -> Dict[str, float]:
    """Plausible daily weather for a site on a given date."""
    rng = rng or _rng(hash((round(latitude, 2), round(longitude, 2), day.toordinal())) & 0xFFFFFFFF)
    doy = day.timetuple().tm_yday
    monsoon = _monsoon_factor(doy)
    lat_adj = max(0.0, (abs(latitude) - 8.0)) * 0.02  # slightly lower irradiance further north
    base_irr = 5.8 - lat_adj + 1.1 * math.cos(2 * math.pi * (doy - 110) / 365.0)
    cloud = float(np.clip(0.15 + 0.55 * monsoon + rng.normal(0, 0.10), 0.02, 0.95))
    irr = float(np.clip(base_irr * (1 - 0.6 * cloud) + rng.normal(0, 0.25), 0.8, 7.5))
    temp = float(27 + 8 * math.cos(2 * math.pi * (doy - 140) / 365.0) - 4 * cloud + rng.normal(0, 1.5))
    humidity = float(np.clip(45 + 40 * monsoon + rng.normal(0, 6), 20, 98))
    coastal = 1.0 if longitude < 74.5 or latitude < 13 else 0.7
    wind = float(np.clip((4.2 + 3.8 * monsoon) * coastal + rng.normal(0, 1.5), 0.5, 22))
    return {
        "temperature_c": round(temp, 1),
        "humidity_pct": round(humidity, 1),
        "cloud_cover_pct": round(cloud * 100, 1),
        "solar_irradiance_kwh_m2": round(irr, 2),
        "wind_speed_ms": round(wind, 1),
    }


def physical_generation_kwh(
    energy_type: str,
    capacity_mw: float,
    weather: Dict[str, float],
    day: Optional[date] = None,
    rng: Optional[np.random.Generator] = None,
    noise: float = 0.04,
) -> float:
    """Daily energy a plant of this type/size would produce under the given weather (kWh)."""
    cap_kw = capacity_mw * 1000.0
    if energy_type == "Solar":
        temp_derate = 1 - 0.004 * max(weather["temperature_c"] - 25.0, 0.0)
        gen = cap_kw * weather["solar_irradiance_kwh_m2"] * SOLAR_PERFORMANCE_RATIO * temp_derate
    elif energy_type == "Wind":
        v = weather["wind_speed_ms"]
        if v < 3.0 or v > 25.0:
            p = 0.0
        else:
            p = min(((v - 3.0) / 9.0) ** 3, 1.0) * 0.92
        gen = cap_kw * 24.0 * p * WIND_AVAILABILITY
    elif energy_type == "Hydro":
        wet = (weather["humidity_pct"] - 40.0) / 60.0
        cf = float(np.clip(0.30 + 0.40 * wet, 0.15, 0.85))
        gen = cap_kw * 24.0 * cf
    elif energy_type == "Biomass":
        gen = cap_kw * 24.0 * 0.62
    else:
        gen = cap_kw * 24.0 * 0.40
    if rng is not None and noise > 0:
        gen *= float(np.clip(rng.normal(1.0, noise), 0.7, 1.3))
    return max(0.0, round(gen, 1))


def make_plant_catalog(n: int, rng: np.random.Generator):
    """Random but plausible plants across Indian states (used only for model training)."""
    sites = [
        ("Gujarat", 23.2, 69.7),
        ("Rajasthan", 26.9, 71.9),
        ("Tamil Nadu", 9.9, 77.4),
        ("Karnataka", 15.3, 76.3),
        ("Maharashtra", 19.2, 74.8),
        ("Andhra Pradesh", 14.4, 78.1),
        ("Madhya Pradesh", 22.9, 76.1),
        ("Telangana", 17.4, 78.5),
        ("Himachal Pradesh", 31.7, 77.2),
        ("Uttarakhand", 30.1, 78.9),
    ]
    plants = []
    for i in range(n):
        state, lat, lon = sites[i % len(sites)]
        etype = ["Solar", "Wind", "Hydro"][i % 3] if i % 7 else "Biomass"
        cap = float(rng.choice([2, 5, 10, 25, 50, 100]))
        plants.append(
            {
                "plant_id": f"TRAIN-{i:03d}",
                "energy_type": etype,
                "capacity_mw": cap,
                "state": state,
                "latitude": lat + float(rng.normal(0, 0.8)),
                "longitude": lon + float(rng.normal(0, 0.8)),
            }
        )
    return plants


def generate_training_frame(n_plants: int = 24, days: int = 365, seed: int = 42, end: Optional[date] = None):
    """DataFrame of daily rows with the model's feature columns + generation_kwh target."""
    import pandas as pd
    from modules.ml.features import FEATURE_COLUMNS, build_feature_row

    rng = _rng(seed)
    end = end or date(2026, 9, 11)
    plants = make_plant_catalog(n_plants, rng)
    rows = []
    for plant in plants:
        history = []
        for d in range(days, 0, -1):
            day = end - timedelta(days=d)
            weather = seasonal_weather(plant["latitude"], plant["longitude"], day, rng)
            gen = physical_generation_kwh(plant["energy_type"], plant["capacity_mw"], weather, day, rng)
            hist = float(np.mean(history[-30:])) if history else gen
            row = build_feature_row(plant, weather, day, hist)
            row["generation_kwh"] = gen
            rows.append(row)
            history.append(gen)
    return pd.DataFrame(rows, columns=FEATURE_COLUMNS + ["generation_kwh"])
