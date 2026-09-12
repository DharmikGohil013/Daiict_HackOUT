"""
GreenShield registry — plants, institutions, generation data, weather, predictions, transactions.
Thin SQLite access layer on top of ledger.get_db().
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from modules.ledger import get_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── plants ─────────────────────────────────────────────────


def upsert_plant(plant: Dict[str, Any]) -> Dict[str, Any]:
    data = {
        "state": None,
        "latitude": None,
        "longitude": None,
        "operator_email": None,
        "status": "active",
        "registered_at": _now(),
        **plant,
    }
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO plants (plant_id, name, energy_type, capacity_mw, location, state, latitude, longitude,
                                operator_email, registered_at, status)
            VALUES (:plant_id, :name, :energy_type, :capacity_mw, :location, :state, :latitude, :longitude,
                    :operator_email, :registered_at, :status)
            ON CONFLICT(plant_id) DO UPDATE SET
                name = excluded.name, energy_type = excluded.energy_type, capacity_mw = excluded.capacity_mw,
                location = excluded.location, state = excluded.state, latitude = excluded.latitude,
                longitude = excluded.longitude, operator_email = excluded.operator_email, status = excluded.status
            """,
            data,
        )
    return get_plant(plant["plant_id"])


def get_plant(plant_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM plants WHERE plant_id = ?", (plant_id,)).fetchone()
        return dict(row) if row else None


def list_plants(
    energy_type: Optional[str] = None, state: Optional[str] = None, search: Optional[str] = None
) -> List[Dict[str, Any]]:
    query = "SELECT * FROM plants WHERE 1=1"
    params: List[Any] = []
    if energy_type:
        query += " AND energy_type = ?"
        params.append(energy_type)
    if state:
        query += " AND state = ?"
        params.append(state)
    if search:
        query += " AND (plant_id LIKE ? OR name LIKE ? OR location LIKE ?)"
        params += [f"%{search}%"] * 3
    with get_db() as conn:
        return [dict(r) for r in conn.execute(query + " ORDER BY plant_id", params).fetchall()]


def set_plant_status(plant_id: str, status: str) -> bool:
    with get_db() as conn:
        return conn.execute("UPDATE plants SET status = ? WHERE plant_id = ?", (status, plant_id)).rowcount == 1


# ── institutions ───────────────────────────────────────────


def upsert_institution(inst: Dict[str, Any]) -> Dict[str, Any]:
    data = {
        "sector": None,
        "location": None,
        "contact_email": None,
        "status": "active",
        "registered_at": _now(),
        **inst,
    }
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO institutions (institution_id, name, sector, location, contact_email, registered_at, status)
            VALUES (:institution_id, :name, :sector, :location, :contact_email, :registered_at, :status)
            ON CONFLICT(institution_id) DO UPDATE SET
                name = excluded.name, sector = excluded.sector, location = excluded.location,
                contact_email = excluded.contact_email, status = excluded.status
            """,
            data,
        )
    return get_institution(inst["institution_id"])


def get_institution(institution_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM institutions WHERE institution_id = ?", (institution_id,)).fetchone()
        return dict(row) if row else None


def list_institutions(search: Optional[str] = None) -> List[Dict[str, Any]]:
    query = "SELECT * FROM institutions"
    params: List[Any] = []
    if search:
        query += " WHERE institution_id LIKE ? OR name LIKE ?"
        params += [f"%{search}%"] * 2
    with get_db() as conn:
        return [dict(r) for r in conn.execute(query + " ORDER BY institution_id", params).fetchall()]


# ── generation data ────────────────────────────────────────


def upsert_generation(
    plant_id: str,
    day: str,
    generation_kwh: float,
    hour: Optional[int] = None,
    meter_reading_kwh: Optional[float] = None,
    operating_hours: Optional[float] = None,
    source: str = "meter",
    submitted_by: Optional[str] = None,
    submitted_at: Optional[str] = None,
    status: str = "pending",
) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO generation_data (plant_id, date, hour, generation_kwh, meter_reading_kwh, operating_hours,
                                         source, submitted_by, submitted_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(plant_id, date, hour) DO UPDATE SET
                generation_kwh = excluded.generation_kwh, meter_reading_kwh = excluded.meter_reading_kwh,
                operating_hours = excluded.operating_hours, source = excluded.source,
                submitted_by = excluded.submitted_by, submitted_at = excluded.submitted_at, status = excluded.status
            """,
            (
                plant_id,
                day,
                -1 if hour is None else int(hour),
                float(generation_kwh),
                meter_reading_kwh,
                operating_hours,
                source,
                submitted_by,
                submitted_at or _now(),
                status,
            ),
        )


def get_generation(
    plant_id: str, start: Optional[str] = None, end: Optional[str] = None, limit: int = 1000
) -> List[Dict[str, Any]]:
    query = "SELECT * FROM generation_data WHERE plant_id = ?"
    params: List[Any] = [plant_id]
    if start:
        query += " AND date >= ?"
        params.append(start)
    if end:
        query += " AND date <= ?"
        params.append(end)
    query += " ORDER BY date ASC, hour ASC LIMIT ?"
    params.append(int(limit))
    with get_db() as conn:
        rows = [dict(r) for r in conn.execute(query, params).fetchall()]
    for r in rows:
        if r.get("hour") == -1:
            r["hour"] = None
    return rows


def get_officer_generation(status: Optional[str] = None, plant_id: Optional[str] = None) -> List[Dict[str, Any]]:
    query = """
        SELECT g.*, p.name as plant_name, p.energy_type, p.capacity_mw 
        FROM generation_data g
        JOIN plants p ON g.plant_id = p.plant_id
        WHERE 1=1
    """
    params = []
    if status and status != 'all':
        query += " AND g.status = ?"
        params.append(status)
    if plant_id and plant_id != 'all':
        query += " AND g.plant_id = ?"
        params.append(plant_id)
        
    query += " ORDER BY g.submitted_at DESC"
    with get_db() as conn:
        rows = [dict(r) for r in conn.execute(query, params).fetchall()]
    for r in rows:
        if r.get("hour") == -1:
            r["hour"] = None
    return rows

def get_officer_generation_stats() -> Dict[str, int]:
    query = "SELECT status, COUNT(*) FROM generation_data GROUP BY status"
    with get_db() as conn:
        rows = conn.execute(query).fetchall()
        res = {"pending": 0, "approved": 0, "declined": 0}
        for row in rows:
            if row[0] in res:
                res[row[0]] = row[1]
        return res


def update_generation_status(id: int, status: str) -> bool:
    with get_db() as conn:
        return conn.execute("UPDATE generation_data SET status = ? WHERE id = ?", (status, id)).rowcount == 1



def sum_generation(plant_id: str, start: str, end: str) -> Optional[float]:
    """Metered total over the period (daily rows only). None when no data exists."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT SUM(generation_kwh), COUNT(*) FROM generation_data WHERE plant_id = ? AND hour = -1 AND date BETWEEN ? AND ?",
            (plant_id, start, end),
        ).fetchone()
        return float(row[0]) if row and row[1] else None


def generation_stats(plant_id: str, start: Optional[str] = None, end: Optional[str] = None) -> Dict[str, Any]:
    query = "SELECT COUNT(*), COALESCE(SUM(generation_kwh),0), COALESCE(AVG(generation_kwh),0), MIN(date), MAX(date) FROM generation_data WHERE plant_id = ? AND hour = -1"  # noqa: E501
    params: List[Any] = [plant_id]
    if start:
        query += " AND date >= ?"
        params.append(start)
    if end:
        query += " AND date <= ?"
        params.append(end)
    with get_db() as conn:
        n, total, avg, first, last = conn.execute(query, params).fetchone()
        return {
            "days": n,
            "total_kwh": round(total, 1),
            "avg_daily_kwh": round(avg, 1),
            "first_date": first,
            "last_date": last,
        }


def monthly_generation(plant_id: Optional[str] = None) -> List[Dict[str, Any]]:
    query = "SELECT substr(date,1,7) AS month, SUM(generation_kwh) AS kwh, COUNT(DISTINCT plant_id) AS plants FROM generation_data WHERE hour = -1"  # noqa: E501
    params: List[Any] = []
    if plant_id:
        query += " AND plant_id = ?"
        params.append(plant_id)
    with get_db() as conn:
        return [dict(r) for r in conn.execute(query + " GROUP BY month ORDER BY month", params).fetchall()]


# ── weather ────────────────────────────────────────────────


def upsert_weather(plant_id: str, day: str, w: Dict[str, float]) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO weather_data (plant_id, date, temperature_c, humidity_pct, cloud_cover_pct, solar_irradiance_kwh_m2, wind_speed_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(plant_id, date) DO UPDATE SET
                temperature_c = excluded.temperature_c, humidity_pct = excluded.humidity_pct,
                cloud_cover_pct = excluded.cloud_cover_pct, solar_irradiance_kwh_m2 = excluded.solar_irradiance_kwh_m2,
                wind_speed_ms = excluded.wind_speed_ms
            """,
            (
                plant_id,
                day,
                w.get("temperature_c"),
                w.get("humidity_pct"),
                w.get("cloud_cover_pct"),
                w.get("solar_irradiance_kwh_m2"),
                w.get("wind_speed_ms"),
            ),
        )


def get_weather(plant_id: str, day: str) -> Optional[Dict[str, float]]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM weather_data WHERE plant_id = ? AND date = ?", (plant_id, day)).fetchone()
        if not row:
            return None
        d = dict(row)
        return {
            k: d[k]
            for k in ("temperature_c", "humidity_pct", "cloud_cover_pct", "solar_irradiance_kwh_m2", "wind_speed_ms")
        }


def get_weather_series(plant_id: str, start: Optional[str] = None, end: Optional[str] = None) -> List[Dict[str, Any]]:
    query = "SELECT * FROM weather_data WHERE plant_id = ?"
    params: List[Any] = [plant_id]
    if start:
        query += " AND date >= ?"
        params.append(start)
    if end:
        query += " AND date <= ?"
        params.append(end)
    with get_db() as conn:
        return [dict(r) for r in conn.execute(query + " ORDER BY date", params).fetchall()]


# ── predictions ────────────────────────────────────────────


def insert_prediction(
    plant_id: str,
    target_date: str,
    predicted: float,
    lower: float,
    upper: float,
    model_version: str,
    features: Optional[Dict] = None,
    horizon_hours: Optional[int] = None,
) -> int:
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO predictions (plant_id, prediction_time, target_date, horizon_hours, predicted_kwh,
                                     lower_bound_kwh, upper_bound_kwh, model_version, features_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                plant_id,
                _now(),
                target_date,
                horizon_hours,
                predicted,
                lower,
                upper,
                model_version,
                json.dumps(features) if features else None,
            ),
        )
        return cur.lastrowid


def latest_predictions(plant_id: str, start: Optional[str] = None, end: Optional[str] = None) -> List[Dict[str, Any]]:
    """Most recent prediction per target date."""
    query = """
        SELECT p.* FROM predictions p
        JOIN (SELECT target_date, MAX(id) AS id FROM predictions WHERE plant_id = ? GROUP BY target_date) m ON m.id = p.id
        WHERE 1=1
    """
    params: List[Any] = [plant_id]
    if start:
        query += " AND p.target_date >= ?"
        params.append(start)
    if end:
        query += " AND p.target_date <= ?"
        params.append(end)
    with get_db() as conn:
        return [dict(r) for r in conn.execute(query + " ORDER BY p.target_date", params).fetchall()]


# ── transactions ───────────────────────────────────────────


def upsert_transaction(txn: Dict[str, Any]) -> Dict[str, Any]:
    data = {
        "cert_id": None,
        "seller_plant_id": None,
        "buyer_institution_id": None,
        "energy_kwh": None,
        "price_inr": None,
        "created_at": _now(),
        **txn,
    }
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO transactions (transaction_id, cert_id, seller_plant_id, buyer_institution_id, energy_kwh, price_inr, created_at)
            VALUES (:transaction_id, :cert_id, :seller_plant_id, :buyer_institution_id, :energy_kwh, :price_inr, :created_at)
            ON CONFLICT(transaction_id) DO UPDATE SET cert_id = excluded.cert_id, seller_plant_id = excluded.seller_plant_id,
                buyer_institution_id = excluded.buyer_institution_id, energy_kwh = excluded.energy_kwh, price_inr = excluded.price_inr
            """,
            data,
        )
        return dict(
            conn.execute("SELECT * FROM transactions WHERE transaction_id = ?", (txn["transaction_id"],)).fetchone()
        )


def list_transactions(
    institution_id: Optional[str] = None, plant_id: Optional[str] = None, limit: int = 200
) -> List[Dict[str, Any]]:
    query = "SELECT * FROM transactions WHERE 1=1"
    params: List[Any] = []
    if institution_id:
        query += " AND buyer_institution_id = ?"
        params.append(institution_id)
    if plant_id:
        query += " AND seller_plant_id = ?"
        params.append(plant_id)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(int(limit))
    with get_db() as conn:
        return [dict(r) for r in conn.execute(query, params).fetchall()]


def counts() -> Dict[str, int]:
    with get_db() as conn:
        return {
            "plants": conn.execute("SELECT COUNT(*) FROM plants").fetchone()[0],
            "institutions": conn.execute("SELECT COUNT(*) FROM institutions").fetchone()[0],
            "generation_rows": conn.execute("SELECT COUNT(*) FROM generation_data").fetchone()[0],
            "weather_rows": conn.execute("SELECT COUNT(*) FROM weather_data").fetchone()[0],
            "predictions": conn.execute("SELECT COUNT(*) FROM predictions").fetchone()[0],
            "transactions": conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0],
        }
