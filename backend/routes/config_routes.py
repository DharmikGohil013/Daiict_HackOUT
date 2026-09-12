"""
Config Routes — exposes domain enum values so frontends never need hardcoded lists.

    GET /api/config/enums  →  energy types, risk levels, claim/certificate statuses, etc.
"""

from flask import Blueprint, jsonify

from config import ALLOWED_OUTPUT_FORMATS, ALLOWED_SOURCE_TYPES

config_bp = Blueprint("config", __name__)

# Canonical domain enums — kept in one place so adding a new energy type or
# status only requires a backend change.
ENUMS = {
    "energy_types": ALLOWED_SOURCE_TYPES,
    "output_formats": sorted(ALLOWED_OUTPUT_FORMATS),
    "risk_levels": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    "claim_statuses": [
        "submitted",
        "verifying",
        "verified",
        "flagged",
        "evidence_requested",
        "approved",
        "rejected",
    ],
    "certificate_statuses": [
        "VALID",
        "NOT_PROVIDED",
        "NOT_FOUND",
        "DUPLICATE",
        "TAMPERED",
        "ID_TAMPERED",
        "REVOKED",
    ],
    "ledger_statuses": ["issued", "claimed", "revoked"],
    "plant_statuses": ["active", "under_review", "suspended"],
    "investigation_statuses": [
        "open",
        "awaiting_evidence",
        "resolved_approved",
        "resolved_rejected",
    ],
    "fraud_types": [
        "none",
        "inflated_generation",
        "tampered_certificate",
        "certificate_id_tampering",
        "duplicate_claim",
        "unregistered_certificate",
        "revoked_certificate",
    ],
    "roles": ["government", "generator", "institution", "issuer"],
}


@config_bp.route("/config/enums", methods=["GET"])
def get_enums():
    """Return all domain enum values.  Cached aggressively by frontends."""
    return jsonify({"success": True, **ENUMS})
