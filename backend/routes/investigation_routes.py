"""Government investigation center."""

from flask import Blueprint, jsonify, request

from modules.claims import decide_claim
from modules.investigations import case_stats, get_case, list_cases
from utils.auth import GOV_ROLES, current_identity, roles_required

investigations_bp = Blueprint("investigations", __name__)


@investigations_bp.route("/investigations", methods=["GET"])
@roles_required(*GOV_ROLES, "auditor")
def get_investigations():
    """GET /api/investigations?status=open|awaiting_evidence|resolved_approved|resolved_rejected"""
    try:
        limit = max(1, min(int(request.args.get("limit", 100)), 500))
    except ValueError:
        limit = 100
    return jsonify(
        {"success": True, "cases": list_cases(request.args.get("status") or None, limit), "stats": case_stats()}
    )


@investigations_bp.route("/investigations/<case_id>", methods=["GET"])
@roles_required(*GOV_ROLES, "auditor")
def get_investigation(case_id):
    case = get_case(case_id)
    if not case:
        return jsonify({"success": False, "error": f"Case '{case_id}' not found."}), 404
    return jsonify({"success": True, "case": case})


@investigations_bp.route("/investigations/<case_id>/decision", methods=["POST"])
@roles_required(*GOV_ROLES)
def investigation_decision(case_id):
    """POST /api/investigations/{id}/decision — {"decision": "approve|reject|request_evidence", "note"}"""
    case = get_case(case_id)
    if not case:
        return jsonify({"success": False, "error": f"Case '{case_id}' not found."}), 404
    data = request.get_json(silent=True) or {}
    ident = current_identity(optional=False)
    try:
        claim = decide_claim(case["claim_id"], str(data.get("decision", "")), ident["email"], data.get("note"))
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 422
    return jsonify({"success": True, "claim": claim, "case": get_case(case_id)})
