"""Dashboard bundles, analytics aggregates, fraud network and entity profiles for GreenShield."""

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from modules import audit, registry
from modules.claims import claim_stats, list_claims
from modules.investigations import case_stats
from modules.ledger import count_certificates, get_db

ALERT_TEXT = {
    "inflated_generation": lambda c: f"{c['plant_id']} reported {c['deviation_pct']:.1f}% above expected generation ({c['claim_id']}).",
    "tampered_certificate": lambda c: f"{c['cert_id']} certificate payload mismatch detected ({c['claim_id']}).",
    "certificate_id_tampering": lambda c: f"{c['cert_id']} certificate ID tampering detected ({c['claim_id']}).",
    "duplicate_claim": lambda c: f"{c['cert_id']} duplicate claim attempt blocked ({c['claim_id']}).",
    "unregistered_certificate": lambda c: f"{c['cert_id']} is not registered in the REC ledger ({c['claim_id']}).",
    "revoked_certificate": lambda c: f"{c['cert_id']} was revoked but submitted in {c['claim_id']}.",
}


def _month(s: Optional[str]) -> str:
    return (s or "")[:7]


# ─────────────────────────────────────────────
# Government
# ─────────────────────────────────────────────


def alerts(limit: int = 8) -> List[Dict[str, Any]]:
    rows = list_claims(min_risk=1, order="risk_score DESC", limit=200)["claims"]
    out = []
    for c in rows:
        if c["status"] in ("flagged", "rejected", "evidence_requested") and c.get("fraud_type") in ALERT_TEXT:
            out.append(
                {
                    "claim_id": c["claim_id"],
                    "cert_id": c["cert_id"],
                    "plant_id": c["plant_id"],
                    "institution_id": c["institution_id"],
                    "fraud_type": c["fraud_type"],
                    "risk_score": c["risk_score"],
                    "risk_level": c["risk_level"],
                    "text": ALERT_TEXT[c["fraud_type"]](c),
                    "at": c["updated_at"],
                }
            )
        if len(out) >= limit:
            break
    return out


def comparison(limit_claims: int = 8) -> Dict[str, Any]:
    """Claimed vs AI expected vs actual — totals, by month and the most deviating claims."""
    rows = list_claims(limit=1000)["claims"]
    by_month: Dict[str, Dict[str, float]] = defaultdict(
        lambda: {"claimed_kwh": 0.0, "expected_kwh": 0.0, "actual_kwh": 0.0, "claims": 0}
    )
    tot = {"claimed_kwh": 0.0, "expected_kwh": 0.0, "actual_kwh": 0.0}
    for c in rows:
        m = _month(c["period_start"])
        for k, src in (("claimed_kwh", "claimed_kwh"), ("expected_kwh", "expected_kwh"), ("actual_kwh", "actual_kwh")):
            v = float(c.get(src) or 0)
            by_month[m][k] += v
            tot[k] += v
        by_month[m]["claims"] += 1
    top = sorted([c for c in rows if c.get("risk_score") is not None], key=lambda c: -(c["risk_score"] or 0))[
        :limit_claims
    ]
    return {
        "totals": {k: round(v, 1) for k, v in tot.items()},
        "by_month": [{"month": m, **{k: round(v, 1) for k, v in d.items()}} for m, d in sorted(by_month.items())],
        "top_claims": [
            {
                "claim_id": c["claim_id"],
                "plant_id": c["plant_id"],
                "institution_id": c["institution_id"],
                "claimed_kwh": c["claimed_kwh"],
                "expected_kwh": c["expected_kwh"],
                "actual_kwh": c["actual_kwh"],
                "risk_score": c["risk_score"],
                "risk_level": c["risk_level"],
                "status": c["status"],
            }
            for c in top
        ],
    }


def government_dashboard() -> Dict[str, Any]:
    cs = claim_stats()
    inv = case_stats()
    reg = registry.counts()
    by_status = cs["by_status"]
    return {
        "kpis": {
            "registered_plants": reg["plants"],
            "registered_institutions": reg["institutions"],
            "active_claims": cs["active_claims"],
            "verified_energy_kwh": cs["verified_energy_kwh"],
            "pending_verification": cs["pending_verification"],
            "suspicious_claims": cs["suspicious_claims"],
            "critical_risk": cs["critical_claims"],
            "certificates_issued": count_certificates(),
            "open_investigations": inv["open"] + inv["awaiting_evidence"],
        },
        "verification_overview": {
            "verified": by_status.get("verified", 0) + by_status.get("approved", 0),
            "pending": by_status.get("submitted", 0)
            + by_status.get("verifying", 0)
            + by_status.get("evidence_requested", 0),
            "flagged": by_status.get("flagged", 0),
            "rejected": by_status.get("rejected", 0),
        },
        "comparison": comparison(),
        "risk_distribution": {lvl: cs["by_risk_level"].get(lvl, 0) for lvl in ("LOW", "MEDIUM", "HIGH", "CRITICAL")},
        "recent_high_risk": list_claims(min_risk=61, order="risk_score DESC", limit=8)["claims"],
        "alerts": alerts(),
        "investigations": inv,
        "recent_audit": audit.recent(10),
        "audit_chain": audit.verify_chain(),
    }


def analytics(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    energy_type: Optional[str] = None,
    state: Optional[str] = None,
) -> Dict[str, Any]:
    with get_db() as conn:
        gq = """
            SELECT substr(g.date,1,7) AS month, SUM(g.generation_kwh) AS kwh
            FROM generation_data g JOIN plants p ON p.plant_id = g.plant_id WHERE g.hour = -1
        """
        params: List[Any] = []
        if date_from:
            gq += " AND g.date >= ?"
            params.append(date_from)
        if date_to:
            gq += " AND g.date <= ?"
            params.append(date_to)
        if energy_type:
            gq += " AND p.energy_type = ?"
            params.append(energy_type)
        if state:
            gq += " AND p.state = ?"
            params.append(state)
        generation_by_month = [dict(r) for r in conn.execute(gq + " GROUP BY month ORDER BY month", params).fetchall()]

    claims = list_claims(energy_type=energy_type, date_from=date_from, date_to=date_to, limit=5000)["claims"]
    if state:
        claims = [c for c in claims if c.get("plant_state") == state]
    by_month: Dict[str, Dict[str, float]] = defaultdict(
        lambda: {"claims": 0, "claimed_kwh": 0.0, "expected_kwh": 0.0, "actual_kwh": 0.0, "flagged": 0, "rejected": 0}
    )
    dev_buckets = {"< -20%": 0, "-20..0%": 0, "0..15%": 0, "15..40%": 0, "40..80%": 0, "> 80%": 0}
    plants: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"claims": 0, "flagged": 0, "risk_sum": 0, "max_risk": 0, "claimed_kwh": 0.0}
    )
    insts: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {
            "claims": 0,
            "flagged": 0,
            "risk_sum": 0,
            "max_risk": 0,
            "claimed_kwh": 0.0,
            "duplicates": 0,
            "tampering": 0,
        }
    )
    risk_dist = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    verified_kwh = rejected_kwh = 0.0
    tampering = duplicates = 0
    score_sum = score_n = 0
    for c in claims:
        m = _month(c["period_start"])
        d = by_month[m]
        d["claims"] += 1
        for k in ("claimed_kwh", "expected_kwh", "actual_kwh"):
            d[k] += float(c.get(k) or 0)
        flagged = c["status"] in ("flagged", "evidence_requested")
        d["flagged"] += int(flagged)
        d["rejected"] += int(c["status"] == "rejected")
        if c["status"] in ("verified", "approved"):
            verified_kwh += c["claimed_kwh"]
        if c["status"] == "rejected":
            rejected_kwh += c["claimed_kwh"]
        if c.get("certificate_status") in ("TAMPERED", "ID_TAMPERED"):
            tampering += 1
        if c.get("certificate_status") == "DUPLICATE":
            duplicates += 1
        if c.get("risk_level"):
            risk_dist[c["risk_level"]] = risk_dist.get(c["risk_level"], 0) + 1
        if c.get("risk_score") is not None:
            score_sum += c["risk_score"]
            score_n += 1
        dev = c.get("deviation_pct")
        if dev is not None:
            key = (
                "< -20%"
                if dev < -20
                else "-20..0%"
                if dev < 0
                else "0..15%"
                if dev <= 15
                else "15..40%"
                if dev <= 40
                else "40..80%"
                if dev <= 80
                else "> 80%"
            )
            dev_buckets[key] += 1
        for bucket, key in ((plants, c["plant_id"]), (insts, c["institution_id"])):
            b = bucket[key]
            b["claims"] += 1
            b["flagged"] += int(flagged or c["status"] == "rejected")
            b["risk_sum"] += c.get("risk_score") or 0
            b["max_risk"] = max(b["max_risk"], c.get("risk_score") or 0)
            b["claimed_kwh"] += c["claimed_kwh"]
            if bucket is insts:
                b["duplicates"] += int(c.get("certificate_status") == "DUPLICATE")
                b["tampering"] += int(c.get("certificate_status") in ("TAMPERED", "ID_TAMPERED"))
    names_p = {p["plant_id"]: p for p in registry.list_plants()}
    names_i = {i["institution_id"]: i for i in registry.list_institutions()}

    def top(bucket, names, key_name, n=8):
        rows = []
        for k, b in bucket.items():
            rows.append(
                {
                    key_name: k,
                    "name": names.get(k, {}).get("name", k),
                    **{x: b[x] for x in b if x != "risk_sum"},
                    "avg_risk": round(b["risk_sum"] / max(b["claims"], 1), 1),
                }
            )
        return sorted(rows, key=lambda r: (-r["avg_risk"], -r["flagged"]))[:n]

    flagged_or_rejected = sum(1 for c in claims if c["status"] in ("flagged", "evidence_requested", "rejected"))
    return {
        "filters": {"date_from": date_from, "date_to": date_to, "energy_type": energy_type, "state": state},
        "generation_by_month": generation_by_month,
        "claims_by_month": [
            {"month": m, **{k: (round(v, 1) if isinstance(v, float) else v) for k, v in d.items()}}
            for m, d in sorted(by_month.items())
        ],
        "verified_energy_kwh": round(verified_kwh, 1),
        "rejected_energy_kwh": round(rejected_kwh, 1),
        "fraud_detection_rate_pct": round(flagged_or_rejected / max(len(claims), 1) * 100, 1),
        "avg_fraud_score": round(score_sum / max(score_n, 1), 1),
        "risk_distribution": risk_dist,
        "deviation_distribution": [{"bucket": k, "claims": v} for k, v in dev_buckets.items()],
        "top_suspicious_generators": top(plants, names_p, "plant_id"),
        "top_suspicious_institutions": top(insts, names_i, "institution_id"),
        "certificate_tampering_attempts": tampering,
        "duplicate_claim_attempts": duplicates,
        "total_claims": len(claims),
        "states": sorted({p["state"] for p in names_p.values() if p.get("state")}),
    }


def fraud_network() -> Dict[str, Any]:
    """Institution ↔ plant relationship graph. Edges carry claim/risk metrics; nothing here is an accusation."""
    claims = list_claims(limit=5000)["claims"]
    plants = {p["plant_id"]: p for p in registry.list_plants()}
    insts = {i["institution_id"]: i for i in registry.list_institutions()}
    edges: Dict[tuple, Dict[str, Any]] = {}
    node_stats: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"claims": 0, "flagged": 0, "energy_kwh": 0.0, "risk_sum": 0, "max_risk": 0, "certificates": set()}
    )
    for c in claims:
        key = (c["institution_id"], c["plant_id"])
        e = edges.setdefault(
            key,
            {
                "source": c["institution_id"],
                "target": c["plant_id"],
                "claims": 0,
                "flagged": 0,
                "energy_kwh": 0.0,
                "risk_sum": 0,
                "max_risk": 0,
                "certificates": set(),
                "fraud_types": set(),
            },
        )
        flagged = c["status"] in ("flagged", "evidence_requested", "rejected")
        e["claims"] += 1
        e["flagged"] += int(flagged)
        e["energy_kwh"] += c["claimed_kwh"]
        e["risk_sum"] += c.get("risk_score") or 0
        e["max_risk"] = max(e["max_risk"], c.get("risk_score") or 0)
        e["certificates"].add(c["cert_id"])
        if c.get("fraud_type") and c["fraud_type"] != "none":
            e["fraud_types"].add(c["fraud_type"])
        for nid in key:
            n = node_stats[nid]
            n["claims"] += 1
            n["flagged"] += int(flagged)
            n["energy_kwh"] += c["claimed_kwh"]
            n["risk_sum"] += c.get("risk_score") or 0
            n["max_risk"] = max(n["max_risk"], c.get("risk_score") or 0)
            n["certificates"].add(c["cert_id"])
    nodes = []
    for pid, p in plants.items():
        s = node_stats.get(
            pid, {"claims": 0, "flagged": 0, "energy_kwh": 0.0, "risk_sum": 0, "max_risk": 0, "certificates": set()}
        )
        nodes.append(
            {
                "id": pid,
                "kind": "plant",
                "label": p["name"],
                "energy_type": p["energy_type"],
                "capacity_mw": p["capacity_mw"],
                "claims": s["claims"],
                "flagged": s["flagged"],
                "avg_risk": round(s["risk_sum"] / max(s["claims"], 1), 1),
                "max_risk": s["max_risk"],
                "energy_kwh": round(s["energy_kwh"], 1),
            }
        )
    for iid, i in insts.items():
        s = node_stats.get(
            iid, {"claims": 0, "flagged": 0, "energy_kwh": 0.0, "risk_sum": 0, "max_risk": 0, "certificates": set()}
        )
        nodes.append(
            {
                "id": iid,
                "kind": "institution",
                "label": i["name"],
                "sector": i.get("sector"),
                "claims": s["claims"],
                "flagged": s["flagged"],
                "avg_risk": round(s["risk_sum"] / max(s["claims"], 1), 1),
                "max_risk": s["max_risk"],
                "energy_kwh": round(s["energy_kwh"], 1),
            }
        )
    edge_list = []
    for e in edges.values():
        avg = round(e["risk_sum"] / max(e["claims"], 1), 1)
        suspicious = (
            avg >= 61
            or e["flagged"] >= 2
            or bool(e["fraud_types"] & {"tampered_certificate", "duplicate_claim", "certificate_id_tampering"})
        )
        edge_list.append(
            {
                **{k: v for k, v in e.items() if k not in ("risk_sum", "certificates", "fraud_types")},
                "avg_risk": avg,
                "certificates": sorted(e["certificates"]),
                "fraud_types": sorted(e["fraud_types"]),
                "relationship": "Potentially Suspicious Relationship" if suspicious else "Normal Relationship",
                "suspicious": suspicious,
            }
        )
    return {
        "nodes": nodes,
        "edges": edge_list,
        "disclaimer": "Relationships are statistical signals for review, not findings of collusion.",
    }


def entity_profile(kind: str, entity_id: str) -> Optional[Dict[str, Any]]:
    if kind == "plant":
        entity = registry.get_plant(entity_id)
        claims = list_claims(plant_id=entity_id, limit=500)["claims"]
    elif kind == "institution":
        entity = registry.get_institution(entity_id)
        claims = list_claims(institution_id=entity_id, limit=500)["claims"]
    else:
        return None
    if not entity:
        return None
    risk_history = [
        {
            "claim_id": c["claim_id"],
            "at": c["submitted_at"],
            "risk_score": c["risk_score"],
            "risk_level": c["risk_level"],
            "status": c["status"],
        }
        for c in sorted(claims, key=lambda c: c["submitted_at"])
    ]
    return {
        "kind": kind,
        "entity": entity,
        "claims": len(claims),
        "total_energy_kwh": round(sum(c["claimed_kwh"] for c in claims), 1),
        "flagged_claims": sum(1 for c in claims if c["status"] in ("flagged", "evidence_requested", "rejected")),
        "certificates": sorted({c["cert_id"] for c in claims}),
        "counterparties": sorted({c["institution_id"] if kind == "plant" else c["plant_id"] for c in claims}),
        "avg_risk": round(sum(c.get("risk_score") or 0 for c in claims) / max(len(claims), 1), 1),
        "risk_history": risk_history,
    }


# ─────────────────────────────────────────────
# Plants
# ─────────────────────────────────────────────


def plant_list_with_stats(
    energy_type: Optional[str] = None, state: Optional[str] = None, search: Optional[str] = None
) -> List[Dict[str, Any]]:
    plants = registry.list_plants(energy_type=energy_type, state=state, search=search)
    with get_db() as conn:
        gen = {
            r[0]: (r[1], r[2])
            for r in conn.execute(
                "SELECT plant_id, COALESCE(SUM(generation_kwh),0), COUNT(*) FROM generation_data WHERE hour = -1 GROUP BY plant_id"
            )
        }
        cl = {
            r[0]: dict(total=r[1], flagged=r[2], avg=r[3], maxr=r[4])
            for r in conn.execute(
                """SELECT plant_id, COUNT(*), SUM(CASE WHEN status IN ('flagged','evidence_requested','rejected') THEN 1 ELSE 0 END),
                      COALESCE(AVG(risk_score),0), COALESCE(MAX(risk_score),0) FROM claims GROUP BY plant_id"""
            )
        }
    out = []
    for p in plants:
        g = gen.get(p["plant_id"], (0, 0))
        c = cl.get(p["plant_id"], {"total": 0, "flagged": 0, "avg": 0, "maxr": 0})
        out.append(
            {
                **p,
                "generation_kwh": round(g[0], 1),
                "generation_days": g[1],
                "claims": c["total"],
                "flagged_claims": c["flagged"],
                "avg_risk": round(c["avg"], 1),
                "max_risk": c["maxr"],
            }
        )
    return out


def plant_profile(plant_id: str, days: int = 60) -> Optional[Dict[str, Any]]:
    plant = registry.get_plant(plant_id)
    if not plant:
        return None
    stats = registry.generation_stats(plant_id)
    end = stats["last_date"] or date.today().isoformat()
    start = (datetime.strptime(end, "%Y-%m-%d") - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    actual = {
        g["date"]: g["generation_kwh"] for g in registry.get_generation(plant_id, start, end) if g.get("hour") is None
    }
    preds = {p["target_date"]: p for p in registry.latest_predictions(plant_id, start, end)}
    weather = {w["date"]: w for w in registry.get_weather_series(plant_id, start, end)}
    series = []
    d = datetime.strptime(start, "%Y-%m-%d")
    while d.strftime("%Y-%m-%d") <= end:
        k = d.strftime("%Y-%m-%d")
        p = preds.get(k)
        w = weather.get(k, {})
        series.append(
            {
                "date": k,
                "actual_kwh": actual.get(k),
                "predicted_kwh": p["predicted_kwh"] if p else None,
                "lower": p["lower_bound_kwh"] if p else None,
                "upper": p["upper_bound_kwh"] if p else None,
                "solar_irradiance_kwh_m2": w.get("solar_irradiance_kwh_m2"),
                "wind_speed_ms": w.get("wind_speed_ms"),
                "cloud_cover_pct": w.get("cloud_cover_pct"),
                "temperature_c": w.get("temperature_c"),
            }
        )
        d += timedelta(days=1)
    claims = list_claims(plant_id=plant_id, limit=200)["claims"]
    flagged = [c for c in claims if c["status"] in ("flagged", "evidence_requested", "rejected")]
    latest_weather = weather.get(end) or registry.get_weather(plant_id, end)
    return {
        "plant": plant,
        "kpis": {
            "total_generation_kwh": stats["total_kwh"],
            "avg_daily_kwh": stats["avg_daily_kwh"],
            "generation_days": stats["days"],
            "total_claims": len(claims),
            "flagged_claims": len(flagged),
            "avg_risk": round(sum(c.get("risk_score") or 0 for c in claims) / max(len(claims), 1), 1),
            "capacity_factor_pct": round(stats["avg_daily_kwh"] / max(plant["capacity_mw"] * 1000 * 24, 1) * 100, 1)
            if stats["days"]
            else None,
        },
        "series": series,
        "monthly_generation": registry.monthly_generation(plant_id),
        "anomalies": flagged,
        "claims": claims,
        "weather": latest_weather,
    }


# ─────────────────────────────────────────────
# Generator portal
# ─────────────────────────────────────────────


def generator_dashboard(plant_id: str) -> Optional[Dict[str, Any]]:
    from modules.ml.service import forecast, predict_daily

    plant = registry.get_plant(plant_id)
    if not plant:
        return None
    stats = registry.generation_stats(plant_id)
    today = stats["last_date"]
    today_gen = today_pred = None
    if today:
        rows = registry.get_generation(plant_id, today, today)
        today_gen = sum(r["generation_kwh"] for r in rows if r.get("hour") is None) or None
        pred = registry.latest_predictions(plant_id, today, today)
        if pred:
            today_pred = {
                "predicted_kwh": pred[0]["predicted_kwh"],
                "lower": pred[0]["lower_bound_kwh"],
                "upper": pred[0]["upper_bound_kwh"],
            }
        else:
            p = predict_daily(plant, today)
            today_pred = {
                "predicted_kwh": p["predicted_kwh"],
                "lower": p["lower_bound_kwh"],
                "upper": p["upper_bound_kwh"],
            }
    deviation = None
    status = "NO DATA"
    if today_gen and today_pred:
        deviation = round((today_gen - today_pred["predicted_kwh"]) / max(today_pred["predicted_kwh"], 1) * 100, 1)
        status = "NORMAL" if abs(deviation) <= 15 else "WATCH" if abs(deviation) <= 40 else "ANOMALY"
    profile = plant_profile(plant_id, days=30)
    return {
        "plant": plant,
        "today": {
            "date": today,
            "generation_kwh": today_gen,
            "expected": today_pred,
            "deviation_pct": deviation,
            "status": status,
        },
        "series_30d": profile["series"] if profile else [],
        "weather": profile["weather"] if profile else None,
        "forecast": forecast(plant_id),
        "claims": list_claims(plant_id=plant_id, limit=20)["claims"],
        "stats": {**stats, **claim_stats(plant_id=plant_id)},
    }


# ─────────────────────────────────────────────
# Institution portal
# ─────────────────────────────────────────────


def institution_certificates(institution_id: str) -> List[Dict[str, Any]]:
    claims = list_claims(institution_id=institution_id, limit=500)["claims"]
    out = []
    with get_db() as conn:
        for c in claims:
            sec = conn.execute("SELECT * FROM certificate_security WHERE cert_id = ?", (c["cert_id"],)).fetchone()
            led = conn.execute(
                "SELECT status, claimed_by, energy_kwh, generation_date, generator_id FROM rec_ledger WHERE cert_id = ?",
                (c["cert_id"],),
            ).fetchone()
            sec = dict(sec) if sec else {}
            led = dict(led) if led else {}
            final = {
                "TAMPERED": "TAMPERED",
                "ID_TAMPERED": "TAMPERED",
                "DUPLICATE": "DUPLICATE",
                "NOT_FOUND": "NOT FOUND",
                "REVOKED": "REVOKED",
            }.get(c.get("certificate_status"), "VALID")
            out.append(
                {
                    "claim_id": c["claim_id"],
                    "cert_id": c["cert_id"],
                    "generator": c["plant_id"],
                    "plant_name": c.get("plant_name"),
                    "energy_kwh": led.get("energy_kwh", c["claimed_kwh"]),
                    "date": led.get("generation_date") or c["period_end"],
                    "hash_status": "MATCH"
                    if sec.get("hash_verified")
                    else ("MISMATCH" if sec.get("hash_verified") == 0 else "NOT CHECKED"),
                    "signature_status": "VALID"
                    if sec.get("signature_verified")
                    else ("INVALID" if sec.get("signature_verified") == 0 else "NOT CHECKED"),
                    "ledger_status": led.get("status", "NOT FOUND").upper(),
                    "claimed_by": led.get("claimed_by"),
                    "claim_status": c["status"],
                    "final_status": final,
                    "risk_score": c["risk_score"],
                    "risk_level": c["risk_level"],
                }
            )
    return out


def institution_dashboard(institution_id: str) -> Optional[Dict[str, Any]]:
    inst = registry.get_institution(institution_id)
    if not inst:
        return None
    cs = claim_stats(institution_id=institution_id)
    txns = registry.list_transactions(institution_id=institution_id)
    return {
        "institution": inst,
        "kpis": {
            "total_purchased_energy_kwh": round(sum(t.get("energy_kwh") or 0 for t in txns), 1)
            or cs["claimed_energy_kwh"],
            "verified_energy_kwh": cs["verified_energy_kwh"],
            "pending_claims": cs["pending_verification"],
            "flagged_claims": cs["flagged_claims"],
            "duplicate_attempts": cs["duplicate_attempts"],
            "total_claims": cs["total_claims"],
        },
        "claims": list_claims(institution_id=institution_id, limit=50)["claims"],
        "certificates": institution_certificates(institution_id),
        "transactions": txns,
    }
