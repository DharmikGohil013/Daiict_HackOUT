"""Claims: submission (JSON or multipart with certificate), listing, detail, government decisions."""

import os
import uuid

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from config import ALLOWED_UPLOAD_EXTENSIONS, uploads_path
from modules import audit, registry
from modules.claims import decide_claim, get_claim, list_claims, submit_claim
from utils.auth import GOV_ROLES, current_identity, is_government, roles_required
from utils.file_utils import sniff_extension
from utils.validators import validate_claim_input

claims_bp = Blueprint("claims", __name__)


def _store_upload(file_storage):
    ext = os.path.splitext(file_storage.filename or "")[1].lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        return None, (
            jsonify({"success": False, "error": f"Unsupported certificate type '{ext}'. Use PNG or PDF."}),
            415,
        )
    folder = uploads_path()
    os.makedirs(folder, exist_ok=True)
    stem = secure_filename(os.path.splitext(file_storage.filename)[0])[:40] or "certificate"
    path = os.path.join(folder, f"{stem}-{uuid.uuid4().hex[:10]}{ext}")
    file_storage.save(path)
    real = sniff_extension(path)
    if real is None:
        os.remove(path)
        return None, (jsonify({"success": False, "error": "Certificate file is not a valid PNG, JPEG or PDF."}), 415)
    if real != ext and not (real == ".jpg" and ext == ".jpeg"):
        new_path = os.path.splitext(path)[0] + real
        os.replace(path, new_path)
        path = new_path
    return path, None


@claims_bp.route("/claims", methods=["POST"])
@jwt_required(optional=True)
def create_claim():
    """
    POST /api/claims — JSON or multipart/form-data
      plant_id, cert_id, transaction_id?, period_start, period_end, claimed_kwh, institution_id (gov only; else from JWT), file? (certificate)  # noqa: E501
    Runs the full pipeline and returns the claim with its verdict.
    """
    ident = current_identity()
    data = request.get_json(silent=True) if request.is_json else {k: v for k, v in request.form.items()}
    data = data or {}
    errors = validate_claim_input(data)
    if errors:
        return jsonify({"success": False, "error": "Validation failed", "details": errors}), 422
    institution_id = str(data.get("institution_id") or "").strip()
    if ident and ident["role"] == "institution":
        institution_id = ident["entity_id"] or institution_id
    if not institution_id:
        return jsonify({"success": False, "error": "institution_id is required (or sign in as an institution)."}), 422
    if not registry.get_institution(institution_id):
        return jsonify({"success": False, "error": f"Unknown institution '{institution_id}'."}), 404
    if not registry.get_plant(data["plant_id"]):
        return jsonify({"success": False, "error": f"Unknown plant '{data['plant_id']}'."}), 404

    file_path = None
    if "file" in request.files and request.files["file"].filename:
        file_path, err = _store_upload(request.files["file"])
        if err:
            return err
    try:
        result = submit_claim(
            institution_id=institution_id,
            plant_id=data["plant_id"],
            cert_id=str(data["cert_id"]).strip(),
            period_start=data["period_start"],
            period_end=data["period_end"],
            claimed_kwh=float(data["claimed_kwh"]),
            transaction_id=(data.get("transaction_id") or "").strip() or None,
            certificate_file_path=file_path,
            submitted_by=ident["email"] if ident else institution_id,
        )
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 422
    return jsonify({"success": True, "claim": result}), 201


@claims_bp.route("/claims", methods=["GET"])
@jwt_required(optional=True)
def get_claims():
    """
    GET /api/claims
      ?status&risk_level&plant_id&institution_id&energy_type&certificate_status&search&date_from&date_to&min_risk&limit&offset&order
    """
    ident = current_identity()
    args = request.args
    plant_id, institution_id = args.get("plant_id") or None, args.get("institution_id") or None
    if ident and not is_government(ident):
        if ident["role"] == "generator":
            plant_id = ident["entity_id"]
        elif ident["role"] == "institution":
            institution_id = ident["entity_id"]
    try:
        limit = max(1, min(int(args.get("limit", 50)), 500))
        offset = max(0, int(args.get("offset", 0)))
        min_risk = int(args["min_risk"]) if args.get("min_risk") else None
    except ValueError:
        return jsonify({"success": False, "error": "limit/offset/min_risk must be integers."}), 400
    data = list_claims(
        status=args.get("status") or None,
        risk_level=(args.get("risk_level") or "").upper() or None,
        plant_id=plant_id,
        institution_id=institution_id,
        energy_type=args.get("energy_type") or None,
        certificate_status=(args.get("certificate_status") or "").upper() or None,
        search=args.get("search") or None,
        date_from=args.get("date_from") or None,
        date_to=args.get("date_to") or None,
        min_risk=min_risk,
        limit=limit,
        offset=offset,
        order=args.get("order", "submitted_at DESC"),
    )
    return jsonify({"success": True, **data})


@claims_bp.route("/claims/<claim_id>", methods=["GET"])
@jwt_required(optional=True)
def get_claim_detail(claim_id):
    """GET /api/claims/{id} — claim + fraud score + certificate security + ledger + audit timeline + generation context."""
    claim = get_claim(claim_id)
    if not claim:
        return jsonify({"success": False, "error": f"Claim '{claim_id}' not found."}), 404
    ident = current_identity()
    if ident and not is_government(ident):
        if (ident["role"] == "generator" and claim["plant_id"] != ident["entity_id"]) or (
            ident["role"] == "institution" and claim["institution_id"] != ident["entity_id"]
        ):
            return jsonify({"success": False, "error": "Not your claim."}), 403
    from modules.investigations import get_case

    case = get_case(claim["case_id"]) if claim.get("case_id") else None
    return jsonify(
        {
            "success": True,
            "claim": claim,
            "audit": audit.timeline(claim_id=claim_id),
            "plant": registry.get_plant(claim["plant_id"]),
            "institution": registry.get_institution(claim["institution_id"]),
            "evidence": case["evidence"] if case else None,
            "investigation": {
                k: v for k, v in case.items() if k not in ("evidence", "claim", "audit", "related_claims")
            }
            if case
            else None,
        }
    )


@claims_bp.route("/claims/<claim_id>/audit", methods=["GET"])
def claim_audit(claim_id):
    events = audit.timeline(claim_id=claim_id)
    if not events:
        return jsonify({"success": False, "error": "No audit events for this claim."}), 404
    return jsonify({"success": True, "claim_id": claim_id, "events": events})


@claims_bp.route("/claims/<claim_id>/decision", methods=["POST"])
@roles_required(*GOV_ROLES)
def claim_decision(claim_id):
    """POST /api/claims/{id}/decision — {"decision": "approve|reject|request_evidence", "note": "..."}"""
    data = request.get_json(silent=True) or {}
    ident = current_identity(optional=False)
    try:
        claim = decide_claim(claim_id, str(data.get("decision", "")), ident["email"], data.get("note"))
    except ValueError as e:
        return (
            jsonify({"success": False, "error": str(e)}),
            422 if "must be" in str(e) or "Cannot" in str(e) or "already" in str(e) else 404,
        )
    return jsonify({"success": True, "claim": claim})
