"""Government investigation center — cases opened for flagged claims, with an evidence bundle."""

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from modules import audit, registry
from modules.ledger import get_db

OFFICERS = ["Officer A. Mehta", "Officer R. Iyer", "Officer S. Kaur", "Officer D. Nair"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def open_case(
    claim_id: str,
    plant_id: str,
    institution_id: str,
    risk_score: int,
    fraud_type: str,
    actor: Optional[str] = None,
    officer: Optional[str] = None,
) -> Dict[str, Any]:
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM investigations WHERE claim_id = ?", (claim_id,)).fetchone()
        if existing:
            return dict(existing)
        n = conn.execute("SELECT COUNT(*) FROM investigations").fetchone()[0]
        case_id = f"INV-{n + 1:04d}"
        while conn.execute("SELECT 1 FROM investigations WHERE case_id = ?", (case_id,)).fetchone():
            n += 1
            case_id = f"INV-{n + 1:04d}"
        officer = officer or OFFICERS[n % len(OFFICERS)]
        conn.execute(
            """
            INSERT INTO investigations (case_id, claim_id, plant_id, institution_id, risk_score, fraud_type,
                                        assigned_officer, status, opened_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)
            """,
            (case_id, claim_id, plant_id, institution_id, int(risk_score), fraud_type, officer, _now()),
        )
        return dict(conn.execute("SELECT * FROM investigations WHERE case_id = ?", (case_id,)).fetchone())


def resolve_for_claim(claim_id: str, status: str, officer: str, note: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM investigations WHERE claim_id = ?", (claim_id,)).fetchone()
        if not row:
            return None
        resolved_at = _now() if status.startswith("resolved") else None
        conn.execute(
            "UPDATE investigations SET status = ?, resolved_at = ?, resolution_note = ?, assigned_officer = COALESCE(?, assigned_officer) WHERE claim_id = ?",  # noqa: E501
            (
                status,
                resolved_at,
                (note or "").strip() or None,
                officer if officer and officer.startswith("Officer") else None,
                claim_id,
            ),
        )
        return dict(conn.execute("SELECT * FROM investigations WHERE claim_id = ?", (claim_id,)).fetchone())


def list_cases(status: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    query = """
        SELECT inv.*, c.cert_id, c.claimed_kwh, c.expected_kwh, c.actual_kwh, c.risk_level, c.status AS claim_status,
               p.name AS plant_name, i.name AS institution_name
        FROM investigations inv
        LEFT JOIN claims c ON c.claim_id = inv.claim_id
        LEFT JOIN plants p ON p.plant_id = inv.plant_id
        LEFT JOIN institutions i ON i.institution_id = inv.institution_id
    """
    params: List[Any] = []
    if status:
        query += " WHERE inv.status = ?"
        params.append(status)
    query += " ORDER BY inv.risk_score DESC, inv.opened_at DESC LIMIT ?"
    params.append(int(limit))
    with get_db() as conn:
        return [dict(r) for r in conn.execute(query, params).fetchall()]


def case_stats() -> Dict[str, int]:
    with get_db() as conn:
        rows = {r[0]: r[1] for r in conn.execute("SELECT status, COUNT(*) FROM investigations GROUP BY status")}
        critical = conn.execute(
            "SELECT COUNT(*) FROM investigations WHERE status IN ('open','awaiting_evidence') AND risk_score > 80"
        ).fetchone()[0]
        return {
            "open": rows.get("open", 0),
            "critical": critical,
            "awaiting_evidence": rows.get("awaiting_evidence", 0),
            "resolved": rows.get("resolved_approved", 0) + rows.get("resolved_rejected", 0),
            "resolved_approved": rows.get("resolved_approved", 0),
            "resolved_rejected": rows.get("resolved_rejected", 0),
        }


def get_case(case_id: str) -> Optional[Dict[str, Any]]:
    """Case + the full evidence bundle the officer needs on one screen."""
    from modules.claims import get_claim, list_claims

    with get_db() as conn:
        row = conn.execute("SELECT * FROM investigations WHERE case_id = ?", (case_id,)).fetchone()
        if not row:
            return None
    case = dict(row)
    claim = get_claim(case["claim_id"])
    if not claim:
        return {**case, "claim": None}
    start = (datetime.strptime(claim["period_start"], "%Y-%m-%d") - timedelta(days=15)).strftime("%Y-%m-%d")
    end = (datetime.strptime(claim["period_end"], "%Y-%m-%d") + timedelta(days=15)).strftime("%Y-%m-%d")
    generation = registry.get_generation(claim["plant_id"], start, end)
    predictions = registry.latest_predictions(claim["plant_id"], start, end)
    weather = registry.get_weather_series(claim["plant_id"], start, end)
    related_plant = [
        c for c in list_claims(plant_id=claim["plant_id"], limit=20)["claims"] if c["claim_id"] != claim["claim_id"]
    ]
    related_inst = [
        c
        for c in list_claims(institution_id=claim["institution_id"], limit=20)["claims"]
        if c["claim_id"] != claim["claim_id"]
    ]
    return {
        **case,
        "claim": claim,
        "plant": registry.get_plant(claim["plant_id"]),
        "institution": registry.get_institution(claim["institution_id"]),
        "evidence": {
            "ai": claim.get("fraud_score"),
            "certificate": claim.get("certificate_security"),
            "ledger": claim.get("ledger_record"),
            "generation": [
                {"date": g["date"], "actual_kwh": g["generation_kwh"], "source": g["source"]}
                for g in generation
                if g.get("hour") is None
            ],
            "predictions": [
                {
                    "date": p["target_date"],
                    "predicted_kwh": p["predicted_kwh"],
                    "lower": p["lower_bound_kwh"],
                    "upper": p["upper_bound_kwh"],
                }
                for p in predictions
            ],
            "weather": weather,
            "steg_payload": json.loads(claim["certificate_security"]["steg_payload_json"])
            if claim.get("certificate_security") and claim["certificate_security"].get("steg_payload_json")
            else None,
        },
        "related_claims": {"same_plant": related_plant, "same_institution": related_inst},
        "audit": audit.timeline(claim_id=claim["claim_id"]),
    }
