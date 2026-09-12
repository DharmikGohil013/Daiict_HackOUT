"""Government-editable runtime configuration of the risk engine."""

from flask import Blueprint, jsonify, request

from modules import audit, settings
from modules.ml import get_model
from utils.auth import GOV_ROLES, current_identity, roles_required

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("/settings/risk", methods=["GET"])
def get_risk_settings():
    """GET /api/settings/risk — thresholds, weights, auto-verify level and model summary."""
    m = get_model()
    return jsonify(
        {
            "success": True,
            **settings.current(),
            "model": {"version": m.version, "trained_at": m.trained_at, "metrics": m.metrics},
        }
    )


@settings_bp.route("/settings/risk", methods=["PUT"])
@roles_required(*GOV_ROLES)
def update_risk_settings():
    """PUT /api/settings/risk — {"thresholds":{"LOW":30,"MEDIUM":60,"HIGH":80},"weights":{...},"auto_verify_max_level":"MEDIUM"}"""
    data = request.get_json(silent=True) or {}
    try:
        normalised = settings.validate(data)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 422
    ident = current_identity(optional=False)
    result = settings.apply(normalised, updated_by=ident["email"])
    audit.record(
        "Risk configuration updated",
        ident["email"],
        detail=f"thresholds {result['thresholds']} weights {result['weights']} auto-verify ≤ {result['auto_verify_max_level']}",
    )
    return jsonify({"success": True, **result})


@settings_bp.route("/settings/risk/reset", methods=["POST"])
@roles_required(*GOV_ROLES)
def reset_risk_settings():
    ident = current_identity(optional=False)
    result = settings.reset_to_env_defaults(updated_by=ident["email"])
    audit.record("Risk configuration reset to defaults", ident["email"])
    return jsonify({"success": True, **result})
