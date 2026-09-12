"""
Runtime risk-engine configuration.

Thresholds, weights and the auto-verify level are read from environment variables by
config.py. Government users can change them at runtime; the new values are written to the
process environment (so every subsequent score uses them) and persisted in app_settings so a
restart reloads them (see load_persisted()).
"""

import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from config import auto_verify_max_level, risk_thresholds, risk_weights
from modules.ledger import get_db

KEYS = ("RISK_THRESHOLDS", "RISK_WEIGHTS", "AUTO_VERIFY_MAX_LEVEL")
WEIGHT_ORDER = ("generation", "historical", "weather", "certificate", "capacity")


def current() -> Dict[str, Any]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT updated_at, updated_by FROM app_settings ORDER BY updated_at DESC LIMIT 1"
        ).fetchone()
    return {
        "thresholds": risk_thresholds(),
        "weights": risk_weights(),
        "auto_verify_max_level": auto_verify_max_level(),
        "updated_at": row["updated_at"] if row else None,
        "updated_by": row["updated_by"] if row else None,
    }


def validate(data: Dict[str, Any]) -> Dict[str, Any]:
    """Return normalised {thresholds, weights, auto_verify_max_level}; raise ValueError on bad input."""
    t = data.get("thresholds") or {}
    w = data.get("weights") or {}
    level = str(data.get("auto_verify_max_level") or auto_verify_max_level()).upper()
    try:
        low, medium, high = (
            int(t.get("LOW", risk_thresholds()["LOW"])),
            int(t.get("MEDIUM", risk_thresholds()["MEDIUM"])),
            int(t.get("HIGH", risk_thresholds()["HIGH"])),
        )
    except (TypeError, ValueError):
        raise ValueError("thresholds LOW/MEDIUM/HIGH must be integers")
    if not (0 <= low < medium < high < 100):
        raise ValueError("thresholds must satisfy 0 <= LOW < MEDIUM < HIGH < 100")
    weights = {}
    defaults = risk_weights()
    for k in WEIGHT_ORDER:
        try:
            weights[k] = int(w.get(k, defaults[k]))
        except (TypeError, ValueError):
            raise ValueError(f"weight '{k}' must be an integer")
        if weights[k] < 0:
            raise ValueError(f"weight '{k}' must be >= 0")
    if sum(weights.values()) != 100:
        raise ValueError(f"weights must sum to 100 (got {sum(weights.values())})")
    if level not in ("LOW", "MEDIUM", "HIGH"):
        raise ValueError("auto_verify_max_level must be LOW, MEDIUM or HIGH")
    return {
        "thresholds": {"LOW": low, "MEDIUM": medium, "HIGH": high},
        "weights": weights,
        "auto_verify_max_level": level,
    }


def apply(settings: Dict[str, Any], updated_by: Optional[str] = None, persist: bool = True) -> Dict[str, Any]:
    t, w = settings["thresholds"], settings["weights"]
    values = {
        "RISK_THRESHOLDS": f"{t['LOW']},{t['MEDIUM']},{t['HIGH']}",
        "RISK_WEIGHTS": ",".join(str(w[k]) for k in WEIGHT_ORDER),
        "AUTO_VERIFY_MAX_LEVEL": settings["auto_verify_max_level"],
    }
    for k, v in values.items():
        os.environ[k] = v
    if persist:
        now = datetime.now(timezone.utc).isoformat()
        with get_db() as conn:
            for k, v in values.items():
                conn.execute(
                    "INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by",  # noqa: E501
                    (k, v, now, updated_by),
                )
    return current()


def load_persisted() -> int:
    """Push persisted overrides into the environment (called at app start). Returns the number applied."""
    try:
        with get_db() as conn:
            rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
    except Exception:
        return 0
    n = 0
    for r in rows:
        if r["key"] in KEYS:
            os.environ[r["key"]] = r["value"]
            n += 1
    return n


def reset_to_env_defaults(updated_by: Optional[str] = None) -> Dict[str, Any]:
    with get_db() as conn:
        conn.execute("DELETE FROM app_settings")
    for k, default in (
        ("RISK_THRESHOLDS", "30,60,80"),
        ("RISK_WEIGHTS", "40,20,20,10,10"),
        ("AUTO_VERIFY_MAX_LEVEL", "MEDIUM"),
    ):
        os.environ[k] = default
    return current()
