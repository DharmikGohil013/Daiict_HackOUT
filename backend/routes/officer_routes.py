"""Issuing Officer routes for approving/declining generation data."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from modules import registry
from modules.issuer import issue_certificate
from utils.auth import current_identity, is_government

officer_bp = Blueprint("officer", __name__)

@officer_bp.route("/officer/generation", methods=["GET"])
@jwt_required(optional=True)
def get_generation():
    ident = current_identity()
    if ident and not is_government(ident):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
        
    status = request.args.get("status") or "pending"
    plant_id = request.args.get("plant_id")
    
    gen_rows = registry.get_officer_generation(status=status, plant_id=plant_id)
    stats = registry.get_officer_generation_stats()
    
    plants = registry.list_plants()
    plant_options = [{"value": p["plant_id"], "label": f"{p['name']} ({p['plant_id']})"} for p in plants]

    for row in gen_rows:
        preds = registry.latest_predictions(row["plant_id"], start=row["date"], end=row["date"])
        p = {p["target_date"]: p for p in preds}.get(row["date"])
        if p and row.get("hour") is None:
            row["predicted_kwh"] = p["predicted_kwh"]
            row["prediction"] = {
                "predicted_kwh": p["predicted_kwh"],
                "lower_bound_kwh": p["lower_bound_kwh"],
                "upper_bound_kwh": p["upper_bound_kwh"],
                "model_version": p["model_version"],
            }
        else:
            row["predicted_kwh"] = None
            row["prediction"] = None
            
        row["weather"] = registry.get_weather(row["plant_id"], row["date"])
        
    return jsonify({"success": True, "rows": gen_rows, "stats": stats, "plants": plant_options})


@officer_bp.route("/officer/approve_generation", methods=["POST"])
@jwt_required(optional=True)
def approve_generation():
    ident = current_identity()
    if ident and not is_government(ident):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
        
    data = request.get_json(silent=True) or {}
    record_id = data.get("id")
    
    if not record_id:
        return jsonify({"success": False, "error": "Generation record ID is required."}), 400
        
    # We need to find the record to get plant details for issuance
    pending = registry.get_officer_generation(status='pending')
    record = next((r for r in pending if str(r["id"]) == str(record_id)), None)
    
    if not record:
        return jsonify({"success": False, "error": "Pending generation record not found."}), 404
        
    # Update status to approved
    registry.update_generation_status(record_id, "approved")
    
    # Issue certificate automatically
    issuer_id = ident.get("email", "SYSTEM") if ident else "SYSTEM"
    result = issue_certificate(
        cert_id=None,
        generator_id=record["plant_id"],
        source_type=record.get("energy_type", "Solar"),
        energy_kwh=float(record["generation_kwh"]),
        generation_date=record["date"],
        issuer_id=issuer_id,
        output_format="png",
    )
    
    if not result["success"]:
        return jsonify({"success": False, "error": result["error"]}), 400
        
    return jsonify({
        "success": True, 
        "cert_id": result["cert_id"],
        "download_url": f"/api/certificate/{result['file_name']}",
    })


@officer_bp.route("/officer/decline_generation", methods=["POST"])
@jwt_required(optional=True)
def decline_generation():
    ident = current_identity()
    if ident and not is_government(ident):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
        
    data = request.get_json(silent=True) or {}
    record_id = data.get("id")
    
    if not record_id:
        return jsonify({"success": False, "error": "Generation record ID is required."}), 400
        
    pending = registry.get_officer_generation(status='pending')
    record = next((r for r in pending if str(r["id"]) == str(record_id)), None)
    
    if not record:
        return jsonify({"success": False, "error": "Pending generation record not found."}), 404
        
    # Update generation status to declined
    registry.update_generation_status(record_id, "declined")
    
    # Flag the plant (set status to 'flagged')
    registry.set_plant_status(record["plant_id"], "flagged")
    
    return jsonify({"success": True})
