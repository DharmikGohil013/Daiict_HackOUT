"""AI generation prediction, forecast and ML service endpoints."""

from flask import Blueprint, jsonify, request

from modules import registry
from modules.ml import anomaly_score, forecast, get_model, predict_period
from modules.ml.service import predict_daily
from modules.risk_engine import score_claim

prediction_bp = Blueprint("prediction", __name__)


def _plant_or_404(plant_id):
    plant = registry.get_plant(plant_id or "")
    if not plant:
        return None, (jsonify({"success": False, "error": f"Plant '{plant_id}' not found."}), 404)
    return plant, None


@prediction_bp.route("/prediction/generation", methods=["POST"])
def prediction_generation():
    """POST /api/prediction/generation — {"plant_id","period_start","period_end"} or {"plant_id","date"}"""
    data = request.get_json(silent=True) or {}
    plant, err = _plant_or_404(data.get("plant_id"))
    if err:
        return err
    try:
        if data.get("date"):
            r = predict_daily(plant, data["date"])
            return jsonify({"success": True, "prediction": r})
        r = predict_period(plant["plant_id"], data["period_start"], data["period_end"])
        actual = registry.sum_generation(plant["plant_id"], r["period_start"], r["period_end"])
        r["actual_kwh"] = actual
        return jsonify({"success": True, "prediction": r})
    except (KeyError, ValueError, TypeError) as e:
        return jsonify({"success": False, "error": f"Invalid request: {e}"}), 422


@prediction_bp.route("/prediction/forecast/<plant_id>", methods=["GET"])
def prediction_forecast(plant_id):
    """GET /api/prediction/forecast/{plantId} — next 24 / 48 / 72 hours."""
    plant, err = _plant_or_404(plant_id)
    if err:
        return err
    horizons = request.args.get("horizons", "24,48,72")
    try:
        hs = [int(h) for h in horizons.split(",")]
    except ValueError:
        hs = [24, 48, 72]
    return jsonify({"success": True, "plant_id": plant_id, "forecast": forecast(plant_id, hs)})


@prediction_bp.route("/ml/model", methods=["GET"])
def ml_model_info():
    return jsonify({"success": True, "model": get_model().info()})


@prediction_bp.route("/ml/predict-generation", methods=["POST"])
def ml_predict():
    """POST /api/ml/predict-generation — same contract as /prediction/generation (ML-service style path)."""
    return prediction_generation()


@prediction_bp.route("/ml/anomaly-score", methods=["POST"])
def ml_anomaly():
    """POST /api/ml/anomaly-score — {"claimed_kwh","expected_kwh","lower_kwh"?,"upper_kwh"?}"""
    d = request.get_json(silent=True) or {}
    try:
        return jsonify(
            {
                "success": True,
                "anomaly": anomaly_score(
                    float(d["claimed_kwh"]), float(d["expected_kwh"]), d.get("lower_kwh"), d.get("upper_kwh")
                ),
            }
        )
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({"success": False, "error": f"Invalid request: {e}"}), 422


@prediction_bp.route("/ml/fraud-score", methods=["POST"])
def ml_fraud_score():
    """POST /api/ml/fraud-score — raw inputs → transparent risk assessment (no claim is created)."""
    d = request.get_json(silent=True) or {}
    try:
        r = score_claim(
            claimed_kwh=float(d["claimed_kwh"]),
            expected_kwh=d.get("expected_kwh"),
            actual_kwh=d.get("actual_kwh"),
            capacity_mw=float(d.get("capacity_mw", 1)),
            period_days=int(d.get("period_days", 1)),
            historical_expected_kwh=d.get("historical_expected_kwh"),
            expected_upper_kwh=d.get("expected_upper_kwh"),
            certificate_status=d.get("certificate_status", "NOT_PROVIDED"),
            energy_type=d.get("energy_type", "Solar"),
        )
        return jsonify({"success": True, "risk": r})
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({"success": False, "error": f"Invalid request: {e}"}), 422
