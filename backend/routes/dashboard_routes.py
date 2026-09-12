"""Role dashboards and government analytics."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from modules import analytics
from utils.auth import GOV_ROLES, current_identity, is_government, may_access_entity, roles_required

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/dashboard/government", methods=["GET"])
@roles_required(*GOV_ROLES, "auditor")
def government():
    return jsonify({"success": True, **analytics.government_dashboard()})


@dashboard_bp.route("/dashboard/generator/<plant_id>", methods=["GET"])
@jwt_required(optional=True)
def generator(plant_id):
    ident = current_identity()
    if ident and ident["role"] == "generator" and not may_access_entity(ident, plant_id):
        return jsonify({"success": False, "error": "Not your plant."}), 403
    data = analytics.generator_dashboard(plant_id)
    if not data:
        return jsonify({"success": False, "error": "Plant not found."}), 404
    return jsonify({"success": True, **data})


@dashboard_bp.route("/dashboard/institution/<institution_id>", methods=["GET"])
@jwt_required(optional=True)
def institution(institution_id):
    ident = current_identity()
    if ident and ident["role"] == "institution" and not may_access_entity(ident, institution_id):
        return jsonify({"success": False, "error": "Not your institution."}), 403
    data = analytics.institution_dashboard(institution_id)
    if not data:
        return jsonify({"success": False, "error": "Institution not found."}), 404
    return jsonify({"success": True, **data})


@dashboard_bp.route("/dashboard/me", methods=["GET"])
@jwt_required()
def me():
    """Dashboard for whoever is signed in — resolves the role to the right bundle."""
    ident = current_identity(optional=False)
    if is_government(ident) or ident["role"] == "auditor":
        return jsonify({"success": True, "role": "government", **analytics.government_dashboard()})
    if ident["role"] == "generator" and ident.get("entity_id"):
        data = analytics.generator_dashboard(ident["entity_id"])
        return jsonify({"success": True, "role": "generator", **(data or {})})
    if ident["role"] == "institution" and ident.get("entity_id"):
        data = analytics.institution_dashboard(ident["entity_id"])
        return jsonify({"success": True, "role": "institution", **(data or {})})
    return jsonify({"success": False, "error": "No dashboard for this role / entity."}), 404


@dashboard_bp.route("/analytics/government", methods=["GET"])
@roles_required(*GOV_ROLES, "auditor")
def analytics_government():
    a = request.args
    return jsonify(
        {
            "success": True,
            **analytics.analytics(
                a.get("date_from") or None,
                a.get("date_to") or None,
                a.get("energy_type") or None,
                a.get("state") or None,
            ),
        }
    )
