"""Fraud analysis, alerts and the relationship network."""

from flask import Blueprint, jsonify, request

from modules import analytics, registry
from modules.ml.service import predict_period
from modules.risk_engine import score_claim

fraud_bp = Blueprint("fraud", __name__)


@fraud_bp.route("/fraud/analyze", methods=["POST"])
def fraud_analyze():
    """
    POST /api/fraud/analyze — what-if analysis without creating a claim.
    {"plant_id","period_start","period_end","claimed_kwh","certificate_status"?}
    """
    d = request.get_json(silent=True) or {}
    plant = registry.get_plant(str(d.get("plant_id") or ""))
    if not plant:
        return jsonify({"success": False, "error": "Unknown plant_id."}), 404
    try:
        claimed = float(d["claimed_kwh"])
        ai = predict_period(plant["plant_id"], d["period_start"], d["period_end"], persist=False)
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({"success": False, "error": f"Invalid request: {e}"}), 422
    actual = registry.sum_generation(plant["plant_id"], ai["period_start"], ai["period_end"])
    risk = score_claim(
        claimed_kwh=claimed,
        expected_kwh=ai["expected_kwh"],
        actual_kwh=actual,
        capacity_mw=plant["capacity_mw"],
        period_days=ai["days"],
        historical_expected_kwh=ai["historical_expected_kwh"],
        expected_upper_kwh=ai["upper_bound_kwh"],
        certificate_status=str(d.get("certificate_status") or "NOT_PROVIDED").upper(),
        energy_type=plant["energy_type"],
    )
    return jsonify(
        {
            "success": True,
            "plant": plant,
            "ai": {k: v for k, v in ai.items() if k != "daily"},
            "actual_kwh": actual,
            "risk": risk,
        }
    )


@fraud_bp.route("/fraud/alerts", methods=["GET"])
def fraud_alerts():
    try:
        limit = max(1, min(int(request.args.get("limit", 10)), 100))
    except ValueError:
        limit = 10
    return jsonify({"success": True, "alerts": analytics.alerts(limit)})


@fraud_bp.route("/fraud/network", methods=["GET"])
def fraud_network():
    """GET /api/fraud/network — institution ↔ plant graph with per-edge risk metrics."""
    return jsonify({"success": True, **analytics.fraud_network()})


@fraud_bp.route("/fraud/network/<kind>/<entity_id>", methods=["GET"])
def fraud_entity(kind, entity_id):
    p = analytics.entity_profile(kind, entity_id)
    if not p:
        return jsonify({"success": False, "error": "Entity not found."}), 404
    return jsonify({"success": True, **p})
