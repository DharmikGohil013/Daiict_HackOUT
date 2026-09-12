"""
GreenShield claims pipeline — the unit of government verification.

submit_claim():
  1. create the claim (status: verifying) and audit it
  2. CRYPTO engine — verify the uploaded certificate (steganography → SHA-256 → RSA → ledger →
     claim state) or, without a file, check the ledger by certificate ID
  3. AI engine — expected generation for the period, actual metered generation
  4. RISK engine — transparent 0–100 score, findings, fraud type
  5. state machine — auto-verify (claims the certificate atomically), flag (opens an
     investigation) or reject (duplicate blocked)
  6. every step is written to the tamper-evident audit trail

decide_claim(): government approve / reject / request evidence.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import structlog

from config import auto_verify_max_level
from modules import audit, registry
from modules.ledger import get_db, lookup_certificate, lookup_certificate_by_hash, mark_claimed
from modules.ml.service import predict_period
from modules.risk_engine import score_claim

log = structlog.get_logger()

LEVEL_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _next_id(prefix: str, table: str, column: str) -> str:
    with get_db() as conn:
        n = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        while True:
            n += 1
            cid = f"{prefix}-{n:04d}"
            if not conn.execute(f"SELECT 1 FROM {table} WHERE {column} = ?", (cid,)).fetchone():
                return cid


# ─────────────────────────────────────────────
# Certificate (crypto) engine
# ─────────────────────────────────────────────


def evaluate_certificate(
    cert_id: str, file_path: Optional[str], actor: Optional[str], claim_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Run the REC security layer for a claim and classify the outcome as one of
    VALID | NOT_PROVIDED | NOT_FOUND | DUPLICATE | REVOKED | TAMPERED | ID_TAMPERED.
    """
    checks = {"steganography": None, "hash": None, "signature": None, "ledger": None, "claim_state": None}
    verification = None
    payload = None
    ledger_rec = lookup_certificate(cert_id)
    original_rec = None
    status = "NOT_PROVIDED"
    reason = ""

    if file_path:
        from modules.verifier import verify_certificate  # local import: verifier pulls in PIL/PyPDF2

        verification = verify_certificate(file_path, verifier_id=actor, claim_cert=False)
        payload = verification.get("extracted_data")
        layers = verification["layers"]
        checks["steganography"] = payload is not None
        checks["hash"] = bool(layers["layer1_steganographic_integrity"]["passed"])
        checks["signature"] = bool(layers["layer2_cryptographic_signature"]["passed"])
        audit.record(
            "Steganographic payload " + ("extracted" if payload else "NOT found"),
            actor,
            claim_id,
            cert_id,
            detail=f"file {file_path.rsplit('/', 1)[-1]}",
            reference_hash=verification.get("file_sha256"),
        )
        audit.record(
            "SHA-256 hash " + ("verified" if checks["hash"] else "MISMATCH"),
            actor,
            claim_id,
            cert_id,
            reference_hash=verification.get("uploaded_hash") or None,
        )
        audit.record("RSA signature " + ("verified" if checks["signature"] else "INVALID"), actor, claim_id, cert_id)

        embedded_id = str(payload.get("cert_id")) if payload and payload.get("cert_id") else None
        embedded_hash = str(payload.get("data_hash")) if payload and payload.get("data_hash") else None
        recomputed_hash = verification.get("uploaded_hash") or None
        if embedded_hash:
            original_rec = lookup_certificate_by_hash(embedded_hash)

        if payload is None:
            status, reason = "TAMPERED", "No hidden payload — forged or unsigned document."
        elif embedded_id and embedded_id != cert_id:
            status, reason = "ID_TAMPERED", f"Submitted ID {cert_id} differs from the signed payload ID {embedded_id}."
        elif not checks["hash"] and original_rec and original_rec["cert_id"] != cert_id:
            status, reason = (
                "ID_TAMPERED",
                f"Signed payload belongs to {original_rec['cert_id']}; the certificate ID was changed to {cert_id}.",
            )
        elif not checks["hash"] or not checks["signature"]:
            status, reason = "TAMPERED", "Payload hash and/or signature do not verify — values altered after issuance."
        elif ledger_rec is None:
            status, reason = "NOT_FOUND", f"{cert_id} is not registered in the REC ledger."
        elif ledger_rec.get("data_hash") != embedded_hash:
            status, reason = "TAMPERED", "Ledger hash does not match the certificate's signed hash."
        elif ledger_rec["status"] == "revoked":
            status, reason = "REVOKED", "Certificate was revoked by the regulator."
        elif ledger_rec["status"] == "claimed":
            status, reason = (
                "DUPLICATE",
                f"Already claimed by {ledger_rec.get('claimed_by')} on {str(ledger_rec.get('claimed_at'))[:10]}.",
            )
        else:
            status, reason = "VALID", "Payload, hash, signature and ledger all agree; not previously claimed."
        checks["ledger"] = (
            ledger_rec is not None and recomputed_hash is not None and ledger_rec.get("data_hash") == recomputed_hash
        )
        checks["claim_state"] = ledger_rec is not None and ledger_rec["status"] == "issued"
    else:
        checks["ledger"] = ledger_rec is not None
        checks["claim_state"] = ledger_rec is not None and ledger_rec["status"] == "issued"
        if ledger_rec is None:
            status, reason = "NOT_FOUND", f"{cert_id} is not registered in the REC ledger."
        elif ledger_rec["status"] == "revoked":
            status, reason = "REVOKED", "Certificate was revoked by the regulator."
        elif ledger_rec["status"] == "claimed":
            status, reason = (
                "DUPLICATE",
                f"Already claimed by {ledger_rec.get('claimed_by')} on {str(ledger_rec.get('claimed_at'))[:10]}.",
            )
        else:
            status, reason = "NOT_PROVIDED", "No certificate file supplied; ledger lookup by ID only."

    audit.record(
        "Ledger lookup completed",
        actor,
        claim_id,
        cert_id,
        detail=f"{status}: {reason}",
        reference_hash=(ledger_rec or {}).get("data_hash"),
    )

    snapshot = {
        "cert_id": cert_id,
        "sha256_hash": (payload or {}).get("data_hash") or (ledger_rec or {}).get("data_hash"),
        "rsa_signature": (payload or {}).get("signature") or (ledger_rec or {}).get("signature"),
        "steg_payload_json": json.dumps(payload) if payload else None,
        "steg_verified": checks["steganography"],
        "hash_verified": checks["hash"],
        "signature_verified": checks["signature"],
        "ledger_verified": checks["ledger"],
        "claim_verified": checks["claim_state"],
        "last_result": status,
        "verified_at": _now(),
    }
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO certificate_security (cert_id, sha256_hash, rsa_signature, steg_payload_json, steg_verified,
                hash_verified, signature_verified, ledger_verified, claim_verified, last_result, verified_at)
            VALUES (:cert_id, :sha256_hash, :rsa_signature, :steg_payload_json, :steg_verified, :hash_verified,
                :signature_verified, :ledger_verified, :claim_verified, :last_result, :verified_at)
            ON CONFLICT(cert_id) DO UPDATE SET sha256_hash = excluded.sha256_hash, rsa_signature = excluded.rsa_signature,
                steg_payload_json = excluded.steg_payload_json, steg_verified = excluded.steg_verified,
                hash_verified = excluded.hash_verified, signature_verified = excluded.signature_verified,
                ledger_verified = excluded.ledger_verified, claim_verified = excluded.claim_verified,
                last_result = excluded.last_result, verified_at = excluded.verified_at
            """,
            {k: (int(v) if isinstance(v, bool) else v) for k, v in snapshot.items()},
        )

    return {
        "status": status,
        "reason": reason,
        "checks": checks,
        "payload": payload,
        "ledger_record": ledger_rec,
        "original_record": original_rec if original_rec and original_rec.get("cert_id") != cert_id else None,
        "verification": verification,
    }


# ─────────────────────────────────────────────
# Submission pipeline
# ─────────────────────────────────────────────


def submit_claim(
    institution_id: str,
    plant_id: str,
    cert_id: str,
    period_start: str,
    period_end: str,
    claimed_kwh: float,
    transaction_id: Optional[str] = None,
    certificate_file_path: Optional[str] = None,
    submitted_by: Optional[str] = None,
    submitted_at: Optional[str] = None,
) -> Dict[str, Any]:
    plant = registry.get_plant(plant_id)
    if not plant:
        raise ValueError(f"Unknown plant {plant_id}")
    if not registry.get_institution(institution_id):
        raise ValueError(f"Unknown institution {institution_id}")
    claimed_kwh = float(claimed_kwh)
    if claimed_kwh <= 0:
        raise ValueError("claimed_kwh must be positive")
    if period_end < period_start:
        raise ValueError("period_end before period_start")

    actor = submitted_by or institution_id
    ts = submitted_at or _now()
    claim_id = _next_id("CLM", "claims", "claim_id")
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO claims (claim_id, cert_id, plant_id, institution_id, transaction_id, period_start, period_end,
                                claimed_kwh, status, certificate_file_path, submitted_by, submitted_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verifying', ?, ?, ?, ?)
            """,
            (
                claim_id,
                cert_id,
                plant_id,
                institution_id,
                transaction_id,
                period_start,
                period_end,
                claimed_kwh,
                certificate_file_path,
                actor,
                ts,
                ts,
            ),
        )
    audit.record(
        "Claim submitted",
        actor,
        claim_id,
        cert_id,
        transaction_id,
        detail=f"{institution_id} claims {claimed_kwh:,.0f} kWh from {plant_id} for {period_start}..{period_end}",
        timestamp=ts,
    )

    # ── crypto engine ──────────────────────────────────────
    cert = evaluate_certificate(cert_id, certificate_file_path, actor, claim_id)

    # ── AI engine ──────────────────────────────────────────
    ai = predict_period(plant_id, period_start, period_end)
    actual = registry.sum_generation(plant_id, period_start, period_end)
    audit.record(
        "AI prediction generated",
        "greenshield-ml",
        claim_id,
        cert_id,
        transaction_id,
        detail=f"expected {ai['expected_kwh']:,.0f} kWh ({ai['lower_bound_kwh']:,.0f}–{ai['upper_bound_kwh']:,.0f}); "
        f"actual {'n/a' if actual is None else f'{actual:,.0f}'} kWh; model {ai['model_version']}",
    )

    # ── risk engine ────────────────────────────────────────
    risk = score_claim(
        claimed_kwh=claimed_kwh,
        expected_kwh=ai["expected_kwh"],
        actual_kwh=actual,
        capacity_mw=plant["capacity_mw"],
        period_days=ai["days"],
        historical_expected_kwh=ai["historical_expected_kwh"],
        expected_upper_kwh=ai["upper_bound_kwh"],
        certificate_status=cert["status"],
        energy_type=plant["energy_type"],
    )
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO fraud_scores (claim_id, generation_score, historical_score, weather_score, certificate_score,
                                      capacity_score, total_score, risk_level, explanation_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(claim_id) DO UPDATE SET generation_score = excluded.generation_score,
                historical_score = excluded.historical_score, weather_score = excluded.weather_score,
                certificate_score = excluded.certificate_score, capacity_score = excluded.capacity_score,
                total_score = excluded.total_score, risk_level = excluded.risk_level,
                explanation_json = excluded.explanation_json, created_at = excluded.created_at
            """,
            (
                claim_id,
                risk["components"]["generation"],
                risk["components"]["historical"],
                risk["components"]["weather"],
                risk["components"]["certificate"],
                risk["components"]["capacity"],
                risk["total_score"],
                risk["risk_level"],
                json.dumps(
                    {
                        "findings": risk["findings"],
                        "checks": risk["checks"],
                        "metrics": risk["metrics"],
                        "weights": risk["weights"],
                        "thresholds": risk["thresholds"],
                        "certificate": {"status": cert["status"], "reason": cert["reason"], "checks": cert["checks"]},
                    }
                ),
                _now(),
            ),
        )
    audit.record(
        "Fraud score calculated",
        "greenshield-risk",
        claim_id,
        cert_id,
        transaction_id,
        detail=f"{risk['total_score']}/100 {risk['risk_level']} — {risk['fraud_type']}",
    )

    # ── state machine ──────────────────────────────────────
    status, decision, note = "flagged", None, None
    if cert["status"] in ("DUPLICATE",):
        status, decision, note = "rejected", "duplicate_blocked", cert["reason"]
        audit.record(
            "Duplicate claim blocked", "greenshield-ledger", claim_id, cert_id, transaction_id, detail=cert["reason"]
        )
    elif cert["status"] in ("VALID", "NOT_PROVIDED"):
        # Always send valid certificates to submitted for REC Verifier
        status, decision = "submitted", "manual_review_required"
        audit.record(
            "Claim pending verification",
            "greenshield-risk",
            claim_id,
            cert_id,
            transaction_id,
            detail=f"claim requires government review",
        )

    with get_db() as conn:
        conn.execute(
            """
            UPDATE claims SET expected_kwh = ?, expected_lower_kwh = ?, expected_upper_kwh = ?, actual_kwh = ?, deviation_pct = ?,
                risk_score = ?, risk_level = ?, certificate_status = ?, fraud_type = ?, status = ?, decision = ?,
                decision_note = ?, updated_at = ?
            WHERE claim_id = ?
            """,
            (
                ai["expected_kwh"],
                ai["lower_bound_kwh"],
                ai["upper_bound_kwh"],
                actual,
                risk["metrics"]["deviation_vs_expected_pct"],
                risk["total_score"],
                risk["risk_level"],
                cert["status"],
                risk["fraud_type"],
                status,
                decision,
                note,
                _now(),
                claim_id,
            ),
        )

    investigation = None
    if status == "flagged":
        from modules.investigations import open_case

        investigation = open_case(
            claim_id, plant_id, institution_id, risk["total_score"], risk["fraud_type"], actor="greenshield-risk"
        )
        audit.record(
            "Investigation opened",
            "greenshield-risk",
            claim_id,
            cert_id,
            transaction_id,
            detail=f"{investigation['case_id']} — {risk['fraud_type']} ({risk['risk_level']})",
        )

    log.info("claim_processed", claim_id=claim_id, status=status, risk=risk["total_score"], cert=cert["status"])
    result = get_claim(claim_id)
    result["investigation"] = investigation
    result["certificate_engine"] = {k: v for k, v in cert.items() if k != "verification"}
    return result


# ─────────────────────────────────────────────
# Government decision
# ─────────────────────────────────────────────


def decide_claim(claim_id: str, decision: str, officer: str, note: Optional[str] = None) -> Dict[str, Any]:
    """decision: approve | reject | request_evidence"""
    claim = get_claim(claim_id)
    if not claim:
        raise ValueError(f"Unknown claim {claim_id}")
    if claim["status"] in ("approved", "rejected"):
        raise ValueError(f"Claim {claim_id} is already {claim['status']}")
    decision = decision.lower()
    if decision not in ("approve", "reject", "request_evidence"):
        raise ValueError("decision must be approve, reject or request_evidence")

    audit.record("Government review started", officer, claim_id, claim["cert_id"], claim["transaction_id"])
    new_status, inv_status = "evidence_requested", "awaiting_evidence"
    if decision == "approve":
        if claim["certificate_status"] in ("VALID", "NOT_PROVIDED"):
            if mark_claimed(claim["cert_id"], claim["institution_id"]):
                audit.record(
                    "Certificate marked claimed",
                    officer,
                    claim_id,
                    claim["cert_id"],
                    claim["transaction_id"],
                    detail=f"claimed by {claim['institution_id']} on government approval",
                )
                new_status, inv_status = "approved", "resolved_approved"
            else:
                decision, note = "reject", (note or "") + " Certificate already claimed by another party — duplicate."
                new_status, inv_status = "rejected", "resolved_rejected"
                audit.record(
                    "Duplicate claim blocked",
                    "greenshield-ledger",
                    claim_id,
                    claim["cert_id"],
                    claim["transaction_id"],
                    detail="approval attempted after certificate was claimed elsewhere",
                )
        else:
            raise ValueError(f"Cannot approve a claim whose certificate is {claim['certificate_status']}")
    elif decision == "reject":
        new_status, inv_status = "rejected", "resolved_rejected"

    with get_db() as conn:
        conn.execute(
            "UPDATE claims SET status = ?, decision = ?, decided_by = ?, decided_at = ?, decision_note = ?, updated_at = ? WHERE claim_id = ?",  # noqa: E501
            (new_status, decision, officer, _now(), (note or "").strip() or None, _now(), claim_id),
        )
    audit.record(
        {"approve": "Claim approved", "reject": "Claim rejected", "request_evidence": "Additional evidence requested"}[
            decision
        ],
        officer,
        claim_id,
        claim["cert_id"],
        claim["transaction_id"],
        detail=(note or "").strip() or None,
    )

    from modules.investigations import resolve_for_claim

    resolve_for_claim(claim_id, inv_status, officer, note)
    return get_claim(claim_id)


# ─────────────────────────────────────────────
# Queries
# ─────────────────────────────────────────────

_CLAIM_SELECT = """
    SELECT c.*, p.name AS plant_name, p.energy_type, p.capacity_mw, p.location AS plant_location, p.state AS plant_state,
           i.name AS institution_name, i.sector AS institution_sector,
           f.generation_score, f.historical_score, f.weather_score, f.certificate_score, f.capacity_score, f.explanation_json,
           inv.case_id, inv.status AS investigation_status
    FROM claims c
    LEFT JOIN plants p ON p.plant_id = c.plant_id
    LEFT JOIN institutions i ON i.institution_id = c.institution_id
    LEFT JOIN fraud_scores f ON f.claim_id = c.claim_id
    LEFT JOIN investigations inv ON inv.claim_id = c.claim_id
"""


def _shape(row) -> Dict[str, Any]:
    d = dict(row)
    expl = d.pop("explanation_json", None)
    d["fraud_score"] = None
    if expl:
        parsed = json.loads(expl)
        d["fraud_score"] = {
            "total": d.get("risk_score"),
            "level": d.get("risk_level"),
            "components": {
                k: d.pop(f"{k}_score") for k in ("generation", "historical", "weather", "certificate", "capacity")
            },
            **parsed,
        }
    else:
        for k in ("generation", "historical", "weather", "certificate", "capacity"):
            d.pop(f"{k}_score", None)
    return d


def get_claim(claim_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        row = conn.execute(_CLAIM_SELECT + " WHERE c.claim_id = ?", (claim_id,)).fetchone()
        if not row:
            return None
        d = _shape(row)
        sec = conn.execute("SELECT * FROM certificate_security WHERE cert_id = ?", (d["cert_id"],)).fetchone()
        d["certificate_security"] = dict(sec) if sec else None
        led = conn.execute("SELECT * FROM rec_ledger WHERE cert_id = ?", (d["cert_id"],)).fetchone()
        d["ledger_record"] = dict(led) if led else None
        return d


def list_claims(
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    plant_id: Optional[str] = None,
    institution_id: Optional[str] = None,
    energy_type: Optional[str] = None,
    certificate_status: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_risk: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    order: str = "submitted_at DESC",
) -> Dict[str, Any]:
    where, params = " WHERE 1=1", []
    if status:
        where += " AND c.status = ?"
        params.append(status)
    if risk_level:
        where += " AND c.risk_level = ?"
        params.append(risk_level)
    if plant_id:
        where += " AND c.plant_id = ?"
        params.append(plant_id)
    if institution_id:
        where += " AND c.institution_id = ?"
        params.append(institution_id)
    if energy_type:
        where += " AND p.energy_type = ?"
        params.append(energy_type)
    if certificate_status:
        where += " AND c.certificate_status = ?"
        params.append(certificate_status)
    if date_from:
        where += " AND c.period_end >= ?"
        params.append(date_from)
    if date_to:
        where += " AND c.period_start <= ?"
        params.append(date_to)
    if min_risk is not None:
        where += " AND c.risk_score >= ?"
        params.append(int(min_risk))
    if search:
        like = f"%{search}%"
        where += " AND (c.claim_id LIKE ? OR c.cert_id LIKE ? OR c.plant_id LIKE ? OR c.institution_id LIKE ? OR p.name LIKE ? OR i.name LIKE ?)"  # noqa: E501
        params += [like] * 6
    allowed_order = {"submitted_at DESC", "submitted_at ASC", "risk_score DESC", "risk_score ASC", "claimed_kwh DESC"}
    order = order if order in allowed_order else "submitted_at DESC"
    with get_db() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM claims c LEFT JOIN plants p ON p.plant_id = c.plant_id LEFT JOIN institutions i ON i.institution_id = c.institution_id"  # noqa: E501
            + where,
            params,
        ).fetchone()[0]
        rows = conn.execute(
            _CLAIM_SELECT + where + f" ORDER BY c.{order} LIMIT ? OFFSET ?", params + [int(limit), int(offset)]
        ).fetchall()
        return {"claims": [_shape(r) for r in rows], "total": total, "limit": limit, "offset": offset}


def claims_for_certificate(cert_id: str) -> List[Dict[str, Any]]:
    with get_db() as conn:
        return [
            _shape(r)
            for r in conn.execute(_CLAIM_SELECT + " WHERE c.cert_id = ? ORDER BY c.submitted_at", (cert_id,)).fetchall()
        ]


def claim_stats(plant_id: Optional[str] = None, institution_id: Optional[str] = None) -> Dict[str, Any]:
    where, params = " WHERE 1=1", []
    if plant_id:
        where += " AND plant_id = ?"
        params.append(plant_id)
    if institution_id:
        where += " AND institution_id = ?"
        params.append(institution_id)
    with get_db() as conn:

        def q(sql, *p):
            return conn.execute(sql, list(params) + list(p)).fetchone()[0]

        total = q("SELECT COUNT(*) FROM claims" + where)
        by_status = {
            r[0]: r[1] for r in conn.execute("SELECT status, COUNT(*) FROM claims" + where + " GROUP BY status", params)
        }
        by_level = {
            r[0]: r[1]
            for r in conn.execute(
                "SELECT risk_level, COUNT(*) FROM claims" + where + " AND risk_level IS NOT NULL GROUP BY risk_level",
                params,
            )
        }
        return {
            "total_claims": total,
            "active_claims": sum(
                by_status.get(s, 0) for s in ("submitted", "verifying", "verified", "flagged", "evidence_requested", "pending_approval")
            ),
            "pending_verification": by_status.get("flagged", 0)
            + by_status.get("evidence_requested", 0)
            + by_status.get("verifying", 0)
            + by_status.get("pending_approval", 0),
            "verified_claims": by_status.get("verified", 0) + by_status.get("approved", 0),
            "flagged_claims": by_status.get("flagged", 0) + by_status.get("evidence_requested", 0),
            "rejected_claims": by_status.get("rejected", 0),
            "suspicious_claims": by_level.get("HIGH", 0) + by_level.get("CRITICAL", 0),
            "critical_claims": by_level.get("CRITICAL", 0),
            "verified_energy_kwh": q(
                "SELECT COALESCE(SUM(claimed_kwh),0) FROM claims" + where + " AND status IN ('verified','approved')"
            ),
            "rejected_energy_kwh": q(
                "SELECT COALESCE(SUM(claimed_kwh),0) FROM claims" + where + " AND status = 'rejected'"
            ),
            "claimed_energy_kwh": q("SELECT COALESCE(SUM(claimed_kwh),0) FROM claims" + where),
            "duplicate_attempts": q("SELECT COUNT(*) FROM claims" + where + " AND certificate_status = 'DUPLICATE'"),
            "tampering_attempts": q(
                "SELECT COUNT(*) FROM claims" + where + " AND certificate_status IN ('TAMPERED','ID_TAMPERED')"
            ),
            "avg_risk_score": round(q("SELECT COALESCE(AVG(risk_score),0) FROM claims" + where), 1),
            "by_status": by_status,
            "by_risk_level": by_level,
        }
