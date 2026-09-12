"""Tamper-evident audit trail."""

from flask import Blueprint, jsonify, request

from modules import audit

audit_bp = Blueprint("audit", __name__)


@audit_bp.route("/audit", methods=["GET"])
def audit_list():
    """GET /api/audit?claim_id&cert_id&transaction_id&limit — newest first."""
    try:
        limit = max(1, min(int(request.args.get("limit", 100)), 1000))
    except ValueError:
        limit = 100
    a = request.args
    events = audit.timeline(
        claim_id=a.get("claim_id") or None,
        transaction_id=a.get("transaction_id") or None,
        cert_id=a.get("cert_id") or None,
        limit=limit,
        newest_first=True,
    )
    return jsonify({"success": True, "events": events, "count": len(events), "chain": audit.verify_chain()})


@audit_bp.route("/audit/verify", methods=["GET"])
def audit_verify():
    return jsonify({"success": True, **audit.verify_chain()})


@audit_bp.route("/audit/<transaction_id>", methods=["GET"])
def audit_by_reference(transaction_id):
    """GET /api/audit/{transactionId} — also accepts a claim ID or certificate ID."""
    events = (
        audit.timeline(transaction_id=transaction_id)
        or audit.timeline(claim_id=transaction_id)
        or audit.timeline(cert_id=transaction_id)
    )
    if not events:
        return jsonify({"success": False, "error": "No audit events for this reference."}), 404
    return jsonify({"success": True, "reference": transaction_id, "events": events})
