"""Generation data: manual/JSON entry, CSV upload, history."""

import csv
import io

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from modules import audit, registry
from utils.auth import current_identity, is_government, may_access_entity
from utils.validators import validate_generation_rows

generation_bp = Blueprint("generation", __name__)

CSV_ALIASES = {
    "date": ("date", "day", "generation_date"),
    "hour": ("hour", "time"),
    "generation_kwh": ("generation_kwh", "generation", "generation (kwh)", "kwh", "energy_kwh"),
    "meter_reading_kwh": ("meter_reading_kwh", "meter_reading", "meter reading", "meter"),
    "operating_hours": ("operating_hours", "operating hours", "hours"),
}


def _normalise_row(raw: dict) -> dict:
    low = {str(k).strip().lower(): v for k, v in raw.items()}
    out = {}
    for field, names in CSV_ALIASES.items():
        for n in names:
            if n in low and str(low[n]).strip() != "":
                out[field] = low[n]
                break
    if "hour" in out:
        h = str(out["hour"]).strip()
        out["hour"] = int(h.split(":")[0]) if ":" in h else int(h) if h.lstrip("-").isdigit() else None
    return out


def _ingest(plant_id: str, rows: list, source: str, actor: str):
    errors = validate_generation_rows(rows)
    if errors:
        return jsonify({"success": False, "error": "Validation failed", "details": errors}), 422
    for r in rows:
        registry.upsert_generation(
            plant_id,
            str(r["date"])[:10],
            float(r["generation_kwh"]),
            hour=r.get("hour") if r.get("hour") not in ("", None) else None,
            meter_reading_kwh=float(r["meter_reading_kwh"]) if r.get("meter_reading_kwh") not in ("", None) else None,
            operating_hours=float(r["operating_hours"]) if r.get("operating_hours") not in ("", None) else None,
            source=source,
            submitted_by=actor,
        )
    dates = sorted(str(r["date"])[:10] for r in rows)
    audit.record(
        "Generation data submitted",
        actor,
        detail=f"{plant_id}: {len(rows)} row(s) {dates[0]}..{dates[-1]} via {source}",
    )
    return (
        jsonify(
            {
                "success": True,
                "plant_id": plant_id,
                "rows": len(rows),
                "first_date": dates[0],
                "last_date": dates[-1],
                "stats": registry.generation_stats(plant_id),
            }
        ),
        201,
    )


@generation_bp.route("/generation", methods=["POST"])
@jwt_required(optional=True)
def submit_generation():
    """POST /api/generation — {"plant_id", "rows": [{date, hour?, generation_kwh, meter_reading_kwh?, operating_hours?}]}"""
    data = request.get_json(silent=True) or {}
    plant_id = str(data.get("plant_id") or "").strip()
    if not plant_id or not registry.get_plant(plant_id):
        return jsonify({"success": False, "error": "Unknown plant_id."}), 404
    ident = current_identity()
    if ident and ident["role"] == "generator" and not may_access_entity(ident, plant_id):
        return jsonify({"success": False, "error": "You may only submit data for your own plant."}), 403
    rows = data.get("rows")
    if rows is None and data.get("date"):
        rows = [{k: data.get(k) for k in ("date", "hour", "generation_kwh", "meter_reading_kwh", "operating_hours")}]
    return _ingest(plant_id, rows or [], "manual", ident["email"] if ident else "anonymous")


@generation_bp.route("/generation/upload", methods=["POST"])
@jwt_required(optional=True)
def upload_generation():
    """POST /api/generation/upload — multipart: plant_id, file (CSV with Date, Time, Generation, Meter Reading, Operating Hours)."""
    plant_id = str(request.form.get("plant_id") or "").strip()
    if not plant_id or not registry.get_plant(plant_id):
        return jsonify({"success": False, "error": "Unknown plant_id."}), 404
    ident = current_identity()
    if ident and ident["role"] == "generator" and not may_access_entity(ident, plant_id):
        return jsonify({"success": False, "error": "You may only upload data for your own plant."}), 403
    if "file" not in request.files or not request.files["file"].filename:
        return jsonify({"success": False, "error": "CSV file required (field 'file')."}), 400
    raw = request.files["file"].read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return jsonify({"success": False, "error": "File must be UTF-8 CSV."}), 415
    rows = [_normalise_row(r) for r in csv.DictReader(io.StringIO(text))]
    rows = [r for r in rows if r]
    if not rows:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "No data rows found. Expected columns: Date, Time, Generation, Meter Reading, Operating Hours.",
                }
            ),
            422,
        )
    return _ingest(plant_id, rows, "csv", ident["email"] if ident else "anonymous")


@generation_bp.route("/generation/<plant_id>", methods=["GET"])
def get_generation(plant_id):
    """GET /api/generation/{plantId}?start&end&limit — history + predictions for the same dates."""
    if not registry.get_plant(plant_id):
        return jsonify({"success": False, "error": "Plant not found."}), 404
    start, end = request.args.get("start"), request.args.get("end")
    try:
        limit = max(1, min(int(request.args.get("limit", 1000)), 5000))
    except ValueError:
        limit = 1000
    rows = registry.get_generation(plant_id, start, end, limit=limit)
    preds = {p["target_date"]: p for p in registry.latest_predictions(plant_id, start, end)}
    for r in rows:
        p = preds.get(r["date"])
        r["predicted_kwh"] = p["predicted_kwh"] if p and r.get("hour") is None else None
    return jsonify(
        {
            "success": True,
            "plant_id": plant_id,
            "rows": rows,
            "count": len(rows),
            "stats": registry.generation_stats(plant_id, start, end),
            "monthly": registry.monthly_generation(plant_id),
        }
    )


@generation_bp.route("/generation/<plant_id>/template.csv", methods=["GET"])
def csv_template(plant_id):
    body = "Date,Time,Generation,Meter Reading,Operating Hours\n2026-09-01,,18400,1284400,11.5\n"
    return (
        body,
        200,
        {"Content-Type": "text/csv", "Content-Disposition": f"attachment; filename={plant_id}_generation_template.csv"},
    )


@generation_bp.route("/generation/stats/summary", methods=["GET"])
@jwt_required(optional=True)
def summary():
    ident = current_identity()
    if ident and not is_government(ident) and ident["role"] == "generator":
        return jsonify({"success": True, "plants": [registry.generation_stats(ident["entity_id"])]})
    return jsonify({"success": True, "monthly": registry.monthly_generation(), "counts": registry.counts()})
