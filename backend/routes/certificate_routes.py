"""Certificates: registry view, single lookup, re-verification, REC issuer and 4-step REC verifier."""

import os

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from config import ALLOWED_UPLOAD_EXTENSIONS
from modules import audit, registry
from modules.claims import claims_for_certificate, evaluate_certificate
from modules.issuer import issue_certificate
from modules.ledger import get_all_certificates, get_db, lookup_certificate
from modules.reconciliation import reconcile_certificate
from modules.verifier import verify_certificate
from utils.auth import GOV_ROLES, ISSUER_ROLES, current_identity, roles_required
from utils.file_utils import cleanup_temp_file, save_uploaded_file, sniff_extension
from utils.validators import validate_issue_input

certificates_bp = Blueprint("certificates", __name__)

FINAL_MAP = {
    "TAMPERED": "TAMPERED",
    "ID_TAMPERED": "TAMPERED",
    "DUPLICATE": "DUPLICATE",
    "NOT_FOUND": "NOT FOUND",
    "REVOKED": "REVOKED",
}


def _final_status(ledger_rec, security) -> str:
    if security and security.get("last_result") in FINAL_MAP:
        return FINAL_MAP[security["last_result"]]
    if not ledger_rec:
        return "NOT FOUND"
    if ledger_rec["status"] == "revoked":
        return "REVOKED"
    if ledger_rec["status"] == "claimed":
        return "CLAIMED"
    return "VALID"


@certificates_bp.route("/certificates", methods=["GET"])
def list_certificates():
    """GET /api/certificates?search&status&limit — ledger joined with security snapshot, claims and final status."""
    try:
        limit = max(1, min(int(request.args.get("limit", 100)), 500))
    except ValueError:
        limit = 100
    certs = get_all_certificates(
        status=request.args.get("status") or None, search=request.args.get("search") or None, limit=limit
    )
    with get_db() as conn:
        sec = {r["cert_id"]: dict(r) for r in conn.execute("SELECT * FROM certificate_security").fetchall()}
        claims = {}
        for r in conn.execute(
            "SELECT cert_id, claim_id, institution_id, status, risk_score, risk_level FROM claims ORDER BY submitted_at"
        ).fetchall():
            claims.setdefault(r["cert_id"], []).append(dict(r))
        plants = {p["plant_id"]: p["name"] for p in registry.list_plants()}
    out = []
    for c in certs:
        s = sec.get(c["cert_id"])
        out.append(
            {
                **{k: v for k, v in c.items() if k != "signature"},
                "plant_name": plants.get(c["generator_id"]),
                "security": s,
                "claims": claims.get(c["cert_id"], []),
                "final_status": _final_status(c, s),
            }
        )
    return jsonify({"success": True, "certificates": out, "count": len(out)})


@certificates_bp.route("/certificates/<cert_id>", methods=["GET"])
def certificate_detail(cert_id):
    """GET /api/certificates/{id} — the spec's certificate verification page in one call."""
    rec = lookup_certificate(cert_id)
    with get_db() as conn:
        sec = conn.execute("SELECT * FROM certificate_security WHERE cert_id = ?", (cert_id,)).fetchone()
        sec = dict(sec) if sec else None
    claims = claims_for_certificate(cert_id)
    if not rec and not sec and not claims:
        return (
            jsonify(
                {
                    "success": False,
                    "error": f"Certificate '{cert_id}' not found in ledger.",
                    "final_status": "NOT FOUND",
                }
            ),
            404,
        )
    reconciliation = None
    if rec:
        reconciliation = reconcile_certificate(
            {
                "generator_id": rec["generator_id"],
                "energy_kwh": rec["energy_kwh"],
                "generation_date": rec["generation_date"],
            }
        )
    plant = registry.get_plant(rec["generator_id"]) if rec else None
    latest_claim = claims[-1] if claims else None
    return jsonify(
        {
            "success": True,
            "cert_id": cert_id,
            "ledger_record": {k: v for k, v in rec.items() if k != "signature"} if rec else None,
            "plant": plant,
            "security": sec,
            "claims": claims,
            "institution_id": latest_claim["institution_id"] if latest_claim else (rec or {}).get("claimed_by"),
            "reconciliation": reconciliation,
            "checks": {
                "hash": "MATCH"
                if sec and sec.get("hash_verified")
                else ("MISMATCH" if sec and sec.get("hash_verified") == 0 else "NOT CHECKED"),
                "rsa": "VALID"
                if sec and sec.get("signature_verified")
                else ("INVALID" if sec and sec.get("signature_verified") == 0 else "NOT CHECKED"),
                "steganography": "VALID"
                if sec and sec.get("steg_verified")
                else ("INVALID" if sec and sec.get("steg_verified") == 0 else "NOT CHECKED"),
                "ledger": "REGISTERED" if rec else "NOT FOUND",
                "claim": (
                    "CLAIMED"
                    if rec and rec["status"] == "claimed"
                    else "REVOKED"
                    if rec and rec["status"] == "revoked"
                    else "NOT CLAIMED"
                )
                if rec
                else "N/A",
            },
            "final_status": _final_status(rec, sec),
            "audit": audit.timeline(cert_id=cert_id, limit=50),
        }
    )


@certificates_bp.route("/certificates/<cert_id>/verify", methods=["POST"])
@jwt_required(optional=True)
def certificate_verify(cert_id):
    """POST /api/certificates/{id}/verify — re-run the crypto engine (optional multipart 'file')."""
    ident = current_identity()
    temp = None
    try:
        if "file" in request.files and request.files["file"].filename:
            ext = os.path.splitext(request.files["file"].filename)[1].lower()
            if ext not in ALLOWED_UPLOAD_EXTENSIONS:
                return jsonify({"success": False, "error": "Use PNG or PDF."}), 415
            temp = save_uploaded_file(request.files["file"], ext)
            if sniff_extension(temp) is None:
                return jsonify({"success": False, "error": "Not a valid PNG, JPEG or PDF."}), 415
        result = evaluate_certificate(cert_id, temp, ident["email"] if ident else "public-verifier")
        result.pop("verification", None)
        result["final_status"] = FINAL_MAP.get(
            result["status"], "VALID" if result["status"] in ("VALID", "NOT_PROVIDED") else result["status"]
        )
        return jsonify({"success": True, "cert_id": cert_id, **result})
    finally:
        cleanup_temp_file(temp)


# ── REC issuer module ──────────────────────────────────────


@certificates_bp.route("/rec/issue", methods=["POST"])
@jwt_required(optional=True)
def rec_issue():
    """
    POST /api/rec/issue — {certificate_id?, generator_id, energy_kwh, generation_date, generation_period?, energy_type, format?}
    Returns the pipeline steps so the UI can animate: input → hash → sign → embed → ledger → issued.
    """
    data = request.get_json(silent=True) or {}
    payload = {
        "generator_id": data.get("generator_id"),
        "source_type": data.get("energy_type") or data.get("source_type") or "Solar",
        "energy_kwh": data.get("energy_kwh"),
        "generation_date": data.get("generation_date"),
        "issuer_id": data.get("issuer_id"),
        "cert_id": data.get("certificate_id") or data.get("cert_id"),
        "format": data.get("format", "png"),
    }
    plant = registry.get_plant(str(payload["generator_id"] or ""))
    if plant and not payload["source_type"]:
        payload["source_type"] = plant["energy_type"]
    errors = validate_issue_input(payload)
    if errors:
        return jsonify({"success": False, "error": "Validation failed", "details": errors}), 422
    ident = current_identity()
    issuer_id = payload["issuer_id"] or (ident["email"] if ident else None) or "ISSUER-NREC-01"
    r = issue_certificate(
        cert_id=payload["cert_id"] or None,
        generator_id=payload["generator_id"],
        source_type=payload["source_type"],
        energy_kwh=float(payload["energy_kwh"]),
        generation_date=payload["generation_date"],
        issuer_id=issuer_id,
        output_format=payload["format"],
    )
    if not r["success"]:
        return jsonify({"success": False, "error": r["error"]}), 400
    audit.record(
        "REC issued",
        issuer_id,
        cert_id=r["cert_id"],
        reference_hash=r["data_hash"],
        detail=f"{payload['generator_id']} {float(payload['energy_kwh']):,.1f} kWh {payload['generation_date']}"
        + (f" period {data['generation_period']}" if data.get("generation_period") else ""),
    )
    p = r["payload"]
    steps = [
        {
            "step": "REC Input Data",
            "status": "done",
            "detail": f"{p['cert_id']} · {p['generator_id']} · {p['energy_kwh']} kWh · {p['generation_date']}",
        },
        {"step": "SHA-256 Hash", "status": "done", "detail": p["data_hash"]},
        {"step": "RSA Digital Signature", "status": "done", "detail": p["signature"][:44] + "…"},
        {"step": "Steganographic Embedding", "status": "done", "detail": f"payload hidden in {r['file_name']} (LSB)"},
        {"step": "Ledger Registration", "status": "done", "detail": "registered as issued, uid assigned"},
        {"step": "REC Issued", "status": "done", "detail": r["issued_at"]},
    ]
    return (
        jsonify(
            {
                "success": True,
                "cert_id": r["cert_id"],
                "hash": r["data_hash"],
                "signature": "VALID",
                "ledger": "REGISTERED",
                "claim_status": "NOT CLAIMED",
                "file_name": r["file_name"],
                "download_url": f"/api/certificate/{r['file_name']}",
                "preview_url": f"/api/certificate/{r['file_name']}/preview",
                "issued_at": r["issued_at"],
                "steps": steps,
                "anomaly_flag": r.get("anomaly_flag"),
                "anomaly_reason": r.get("anomaly_reason"),
                "payload": p,
            }
        ),
        201,
    )


# ── REC verifier module (4 steps) ──────────────────────────


@certificates_bp.route("/rec/verify", methods=["POST"])
@jwt_required(optional=True)
def rec_verify():
    """POST /api/rec/verify — multipart 'file' (PNG/PDF). Steps: steg integrity → signature → ledger → generation reconciliation."""
    if "file" not in request.files or not request.files["file"].filename:
        return jsonify({"success": False, "error": "Upload a certificate file (field 'file')."}), 400
    ext = os.path.splitext(request.files["file"].filename)[1].lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        return jsonify({"success": False, "error": f"Unsupported file type '{ext}'. Use PNG or PDF."}), 415
    temp = save_uploaded_file(request.files["file"], ext)
    try:
        real = sniff_extension(temp)
        if real is None:
            return jsonify({"success": False, "error": "Not a valid PNG, JPEG or PDF."}), 415
        if real != ext and not (real == ".jpg" and ext == ".jpeg"):
            new = os.path.splitext(temp)[0] + real
            os.replace(temp, new)
            temp = new
        ident = current_identity()
        v = verify_certificate(temp, verifier_id=ident["email"] if ident else None, verifier_ip=request.remote_addr)
        layers = v["layers"]
        payload = v.get("extracted_data") or {}
        ledger_rec = v.get("ledger_record")
        cert_id = v.get("cert_id")
        crypto = (
            evaluate_certificate(cert_id, temp, ident["email"] if ident else "public-verifier") if cert_id else None
        )
        cert_status = crypto["status"] if crypto else "TAMPERED"
        recon = (
            reconcile_certificate(payload)
            if payload and layers["layer1_steganographic_integrity"]["passed"]
            else {"status": "SKIPPED", "detail": "No trustworthy payload to reconcile."}
        )

        def step(n, name, passed, detail, skipped=False):
            return {
                "step": n,
                "name": name,
                "status": "skipped" if skipped else ("pass" if passed else "fail"),
                "detail": detail,
            }

        l1, l2, l3 = (
            layers["layer1_steganographic_integrity"],
            layers["layer2_cryptographic_signature"],
            layers["layer3_ledger_lookup"],
        )
        steps = [
            step(1, "Steganographic Integrity", l1["passed"], l1["detail"]),
            step(2, "Signature Authentication", l2["passed"], l2["detail"], skipped=l2["detail"].startswith("Skipped")),
            step(3, "Ledger Lookup", l3["passed"], l3["detail"], skipped=l3["detail"].startswith("Skipped")),
            step(
                4,
                "Generation Reconciliation",
                recon["status"] == "CONSISTENT",
                recon["detail"],
                skipped=recon["status"] in ("SKIPPED", "UNKNOWN"),
            ),
        ]
        if cert_status in ("DUPLICATE",):
            final, headline = "DUPLICATE", "DUPLICATE CLAIM — certificate is already marked as CLAIMED."
        elif cert_status in ("TAMPERED", "ID_TAMPERED") or not l1["passed"] or not l2["passed"]:
            final, headline = "TAMPERED", "FRAUD / TAMPERED — " + (
                "certificate ID tampering detected."
                if cert_status == "ID_TAMPERED"
                else "hash and/or signature do not verify."
            )
        elif cert_status in ("NOT_FOUND", "REVOKED"):
            final, headline = (
                cert_status.replace("_", " "),
                f"Certificate is {cert_status.replace('_', ' ').lower()} in the REC ledger.",
            )
        elif recon["status"] == "INCONSISTENT":
            final, headline = (
                "INCONSISTENT",
                "Certificate is authentic but the certified energy exceeds what the plant could have generated.",
            )
        else:
            final, headline = "VALID", "VALID REC — authentic, registered, not claimed" + (
                ", generation consistent." if recon["status"] == "CONSISTENT" else "."
            )
        return jsonify(
            {
                "success": True,
                "final_result": final,
                "headline": headline,
                "cert_id": cert_id,
                "steps": steps,
                "summary": {
                    "hash": "MATCH" if l1["passed"] else "MISMATCH",
                    "rsa": "VALID"
                    if l2["passed"]
                    else ("SKIPPED" if l2["detail"].startswith("Skipped") else "INVALID"),
                    "ledger": "REGISTERED"
                    if ledger_rec
                    else ("MISMATCH" if cert_status == "TAMPERED" and payload else "NOT FOUND"),
                    "claimed": "YES" if ledger_rec and ledger_rec.get("status") == "claimed" else "NO",
                    "generation": recon["status"],
                },
                "certificate_status": cert_status,
                "extracted_data": payload or None,
                "ledger_record": ledger_rec,
                "reconciliation": recon,
                "original_record": crypto.get("original_record") if crypto else None,
                "file_sha256": v.get("file_sha256"),
            }
        )
    finally:
        cleanup_temp_file(temp)


@certificates_bp.route("/rec/revoke/<cert_id>", methods=["POST"])
@roles_required(*GOV_ROLES, *ISSUER_ROLES)
def rec_revoke(cert_id):
    from modules.ledger import revoke_certificate

    ident = current_identity(optional=False)
    if not revoke_certificate(cert_id, ident["email"]):
        return jsonify({"success": False, "error": "Certificate not found or already revoked."}), 400
    audit.record(
        "REC revoked", ident["email"], cert_id=cert_id, detail=(request.get_json(silent=True) or {}).get("reason")
    )
    return jsonify({"success": True, "cert_id": cert_id, "status": "revoked"})
