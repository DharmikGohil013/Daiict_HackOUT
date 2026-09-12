"""
Step 4 of the REC verifier — generation reconciliation.

Given a certificate's signed payload (generator, energy, generation date), compare the
certified energy with what the plant actually metered and what the AI model expected,
over the window the certificate most plausibly covers (one day, or the trailing period
ending on the generation date).
"""

from datetime import datetime, timedelta
from typing import Any, Dict

from modules import registry
from modules.ml.service import predict_period
from modules.ml.synthetic import physical_generation_kwh, seasonal_weather

TOLERANCE_PCT = 15.0


def _window_for(plant: Dict[str, Any], energy_kwh: float, end: datetime) -> int:
    """
    Days the certificate plausibly covers. RECs are issued per day, week, fortnight or
    calendar month at most, so the window is capped at one month — otherwise an inflated
    energy figure would simply imply a longer window and reconcile against itself.
    """
    max_day = plant["capacity_mw"] * 1000 * 24
    if energy_kwh <= max_day:
        return 1
    typical = physical_generation_kwh(
        plant["energy_type"],
        plant["capacity_mw"],
        seasonal_weather(float(plant.get("latitude") or 22), float(plant.get("longitude") or 72), end.date()),
    )
    days = energy_kwh / max(typical, 1.0)
    if days <= 10:
        return 7
    if days <= 20:
        return 14
    next_day = end + timedelta(days=1)
    return end.day if next_day.day == 1 else 30  # calendar month when dated at month end, else trailing 30 days


def reconcile_certificate(payload: Dict[str, Any], persist: bool = False) -> Dict[str, Any]:
    plant_id = str(payload.get("generator_id") or "")
    plant = registry.get_plant(plant_id) if plant_id else None
    try:
        energy = float(payload.get("energy_kwh"))
        end = datetime.strptime(str(payload.get("generation_date"))[:10], "%Y-%m-%d")
    except (TypeError, ValueError):
        return {
            "status": "UNKNOWN",
            "detail": "Certificate payload has no usable energy / generation date.",
            "plant_registered": bool(plant),
        }
    if not plant:
        return {
            "status": "UNKNOWN",
            "detail": f"Generator {plant_id or '?'} is not registered on GreenShield; no generation data to reconcile against.",
            "plant_registered": False,
            "certified_kwh": energy,
        }

    days = _window_for(plant, energy, end)
    start = end - timedelta(days=days - 1)
    ai = predict_period(plant_id, start.date(), end.date(), persist=persist)
    actual = registry.sum_generation(plant_id, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
    expected = ai["expected_kwh"]
    dev_expected = (energy - expected) / max(expected, 1.0) * 100
    dev_actual = (energy - actual) / max(actual, 1.0) * 100 if actual else None
    if dev_expected > TOLERANCE_PCT or (dev_actual is not None and dev_actual > TOLERANCE_PCT):
        status = "INCONSISTENT"
        detail = (
            f"Certified {energy:,.0f} kWh is {dev_expected:+.1f}% vs AI expected and "
            + (f"{dev_actual:+.1f}% vs metered generation" if dev_actual is not None else "no meter data")
            + f" over {days} day(s) ending {end.date()}."
        )
    else:
        status = "CONSISTENT"
        detail = (
            f"Certified {energy:,.0f} kWh is within tolerance of AI expected ({expected:,.0f} kWh)"
            + (f" and metered ({actual:,.0f} kWh)" if actual else "")
            + f" over {days} day(s) ending {end.date()}."
        )
    return {
        "status": status,
        "detail": detail,
        "plant_registered": True,
        "plant": {
            "plant_id": plant_id,
            "name": plant["name"],
            "energy_type": plant["energy_type"],
            "capacity_mw": plant["capacity_mw"],
        },
        "window_days": days,
        "period_start": start.strftime("%Y-%m-%d"),
        "period_end": end.strftime("%Y-%m-%d"),
        "certified_kwh": round(energy, 1),
        "expected_kwh": expected,
        "expected_lower_kwh": ai["lower_bound_kwh"],
        "expected_upper_kwh": ai["upper_bound_kwh"],
        "actual_kwh": round(actual, 1) if actual else None,
        "deviation_vs_expected_pct": round(dev_expected, 1),
        "deviation_vs_actual_pct": round(dev_actual, 1) if dev_actual is not None else None,
        "tolerance_pct": TOLERANCE_PCT,
    }
