"""Plants and institutions."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from modules import analytics, registry
from utils.auth import GOV_ROLES, ISSUER_ROLES, roles_required

registry_bp = Blueprint("registry", __name__)


@registry_bp.route("/plants", methods=["GET"])
def list_plants():
    """GET /api/plants?energy_type=&state=&search= — registry with generation/claim/risk stats."""
    plants = analytics.plant_list_with_stats(
        request.args.get("energy_type") or None, request.args.get("state") or None, request.args.get("search") or None
    )
    return jsonify({"success": True, "plants": plants, "count": len(plants)})


@registry_bp.route("/plants", methods=["POST"])
@roles_required(*GOV_ROLES, *ISSUER_ROLES)
def create_plant():
    data = request.get_json(silent=True) or {}
    required = ("plant_id", "name", "energy_type", "capacity_mw", "location")
    missing = [k for k in required if not str(data.get(k) or "").strip()]
    if missing:
        return jsonify({"success": False, "error": f"Missing fields: {', '.join(missing)}"}), 422
    try:
        data["capacity_mw"] = float(data["capacity_mw"])
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "capacity_mw must be numeric."}), 422
    return (
        jsonify(
            {
                "success": True,
                "plant": registry.upsert_plant(
                    {
                        k: data.get(k)
                        for k in (
                            "plant_id",
                            "name",
                            "energy_type",
                            "capacity_mw",
                            "location",
                            "state",
                            "latitude",
                            "longitude",
                            "operator_email",
                        )
                        if data.get(k) is not None
                    }
                ),
            }
        ),
        201,
    )


@registry_bp.route("/plants/<plant_id>", methods=["GET"])
def plant_profile(plant_id):
    """GET /api/plants/{id}?days=60 — profile with KPIs, actual vs predicted series, monthly, anomalies, weather."""
    try:
        days = max(7, min(int(request.args.get("days", 60)), 365))
    except ValueError:
        days = 60
    profile = analytics.plant_profile(plant_id, days=days)
    if not profile:
        return jsonify({"success": False, "error": f"Plant '{plant_id}' not found."}), 404
    return jsonify({"success": True, **profile})


@registry_bp.route("/plants/<plant_id>/status", methods=["POST"])
@roles_required(*GOV_ROLES)
def set_status(plant_id):
    status = (request.get_json(silent=True) or {}).get("status")
    if status not in ("active", "under_review", "suspended"):
        return jsonify({"success": False, "error": "status must be active, under_review or suspended."}), 422
    if not registry.set_plant_status(plant_id, status):
        return jsonify({"success": False, "error": "Plant not found."}), 404
    return jsonify({"success": True, "plant": registry.get_plant(plant_id)})


@registry_bp.route("/plants/<plant_id>/weather", methods=["GET"])
def plant_weather(plant_id):
    if not registry.get_plant(plant_id):
        return jsonify({"success": False, "error": "Plant not found."}), 404
    return jsonify(
        {
            "success": True,
            "weather": registry.get_weather_series(plant_id, request.args.get("start"), request.args.get("end")),
        }
    )


@registry_bp.route("/institutions", methods=["GET"])
def list_institutions():
    insts = registry.list_institutions(request.args.get("search") or None)
    return jsonify({"success": True, "institutions": insts, "count": len(insts)})


@registry_bp.route("/institutions", methods=["POST"])
@roles_required(*GOV_ROLES)
def create_institution():
    data = request.get_json(silent=True) or {}
    if not data.get("institution_id") or not data.get("name"):
        return jsonify({"success": False, "error": "institution_id and name are required."}), 422
    return (
        jsonify(
            {
                "success": True,
                "institution": registry.upsert_institution(
                    {
                        k: data.get(k)
                        for k in ("institution_id", "name", "sector", "location", "contact_email")
                        if data.get(k) is not None
                    }
                ),
            }
        ),
        201,
    )


@registry_bp.route("/institutions/<institution_id>", methods=["GET"])
@jwt_required(optional=True)
def institution_detail(institution_id):
    data = analytics.institution_dashboard(institution_id)
    if not data:
        return jsonify({"success": False, "error": "Institution not found."}), 404
    return jsonify({"success": True, **data})
