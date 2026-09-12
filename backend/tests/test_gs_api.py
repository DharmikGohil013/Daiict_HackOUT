"""GreenShield REST API — every Phase 2 endpoint through the Flask test client."""

import io
from datetime import date, timedelta

import pytest
from PIL import Image
from werkzeug.security import generate_password_hash

from app import create_app
from modules import ledger, registry
from modules.issuer import issue_certificate
from modules.ml.synthetic import physical_generation_kwh, seasonal_weather
from modules.steg import embed_payload_in_png, extract_payload_from_file

PLANT = {
    "plant_id": "GEN-001",
    "name": "Kutch Solar Park A",
    "energy_type": "Solar",
    "capacity_mw": 5,
    "location": "Bhuj, Gujarat",
    "state": "Gujarat",
    "latitude": 23.24,
    "longitude": 69.67,
}
AUG = ("2026-08-01", "2026-08-31")
PW = "Demo@1234"


@pytest.fixture
def app(isolated_env, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@test.io")
    monkeypatch.setenv("ADMIN_PASSWORD", "adminpass123")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-jwt-secret-that-is-at-least-32-bytes-long")
    monkeypatch.setenv("UPLOADS_PATH", str(isolated_env / "uploads"))
    return create_app({"TESTING": True})


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def world(app):
    registry.upsert_plant(PLANT)
    registry.upsert_institution({"institution_id": "INST-045", "name": "Acme Steel", "sector": "Steel"})
    registry.upsert_institution({"institution_id": "INST-042", "name": "GreenTech", "sector": "Tech"})
    for back in range(75, 11, -1):
        d = date(2026, 9, 12) - timedelta(days=back)
        w = seasonal_weather(PLANT["latitude"], PLANT["longitude"], d)
        registry.upsert_weather("GEN-001", d.isoformat(), w)
        registry.upsert_generation("GEN-001", d.isoformat(), physical_generation_kwh("Solar", 5, w), source="seed")
    users = {
        "gov": ("gov@greenshield.gov", "government", None),
        "gen": ("ops@gen-001.in", "generator", "GEN-001"),
        "inst": ("claims@inst-045.org", "institution", "INST-045"),
        "inst2": ("esg@greentech.in", "institution", "INST-042"),
        "issuer": ("issuer@greenshield.gov", "issuer", None),
    }
    for email, role, entity in users.values():
        ledger.create_user(
            email,
            generate_password_hash(PW),
            role=role,
            organisation="Org",
            entity_id=entity,
            display_name=role.title(),
        )
    return {"actual": registry.sum_generation("GEN-001", *AUG), "users": users}


@pytest.fixture
def tokens(client, world):
    out = {}
    for key, (email, _, _) in world["users"].items():
        r = client.post("/api/auth/login", json={"email": email, "password": PW})
        assert r.status_code == 200, r.get_json()
        out[key] = r.get_json()["access_token"]
    return out


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _issue(cert_id, kwh, generation_date="2026-08-31"):
    r = issue_certificate(
        cert_id=cert_id,
        generator_id="GEN-001",
        source_type="Solar",
        energy_kwh=kwh,
        generation_date=generation_date,
        issuer_id="ISSUER-NREC-01",
    )
    assert r["success"], r
    return r["file_path"]


def _tamper(src, dst, **changes):
    p = extract_payload_from_file(src)
    p.update(changes)
    return embed_payload_in_png(src, p, dst)


def _multipart(fields, path=None, name="cert.png"):
    data = {k: str(v) for k, v in fields.items()}
    if path:
        data["file"] = (open(path, "rb"), name)
    return data


def _claim(client, token, fields, path=None):
    return client.post(
        "/api/claims", data=_multipart(fields, path), content_type="multipart/form-data", headers=_auth(token)
    )


# ── auth ───────────────────────────────────────────────────


def test_demo_logins(client, world):
    assert client.post("/api/auth/demo/wizard").status_code == 404
    r = client.post("/api/auth/demo/government")
    assert r.status_code == 200 and r.get_json()["user"]["role"] == "government"
    r = client.post("/api/auth/demo/generator")
    assert r.status_code == 200 and r.get_json()["user"]["entity_id"] == "GEN-001"
    assert client.post("/api/auth/demo/institution").get_json()["user"]["entity_id"] == "INST-045"
    assert client.post("/api/auth/demo/issuer").status_code == 200


def test_demo_login_unseeded(client):
    assert client.post("/api/auth/demo/government").status_code == 503


def test_login_role_mismatch_and_me(client, world, tokens):
    r = client.post("/api/auth/login", json={"email": "ops@gen-001.in", "password": PW, "role": "government"})
    assert r.status_code == 403
    r = client.post("/api/auth/login", json={"email": "ops@gen-001.in", "password": PW, "role": "generator"})
    assert r.status_code == 200
    me = client.get("/api/auth/me", headers=_auth(tokens["gen"])).get_json()
    assert me["entity_id"] == "GEN-001" and me["role"] == "generator" and me["display_name"] == "Generator"


# ── plants / institutions ──────────────────────────────────


def test_plants_list_create_profile(client, world, tokens):
    r = client.get("/api/plants")
    body = r.get_json()
    assert r.status_code == 200 and body["count"] == 1
    p = body["plants"][0]
    for k in ("generation_kwh", "generation_days", "claims", "flagged_claims", "avg_risk", "max_risk"):
        assert k in p
    assert p["generation_days"] == 64

    new = {
        "plant_id": "GEN-002",
        "name": "Wind",
        "energy_type": "Wind",
        "capacity_mw": 25,
        "location": "Jaisalmer",
        "state": "Rajasthan",
    }
    assert client.post("/api/plants", json=new, headers=_auth(tokens["inst"])).status_code == 403
    assert client.post("/api/plants", json=new).status_code == 401
    r = client.post("/api/plants", json=new, headers=_auth(tokens["gov"]))
    assert r.status_code == 201 and r.get_json()["plant"]["plant_id"] == "GEN-002"
    assert client.post("/api/plants", json={"plant_id": "X"}, headers=_auth(tokens["gov"])).status_code == 422
    assert (
        client.post("/api/plants", json={**new, "capacity_mw": "big"}, headers=_auth(tokens["issuer"])).status_code
        == 422
    )
    assert client.get("/api/plants?energy_type=Wind").get_json()["count"] == 1
    assert client.get("/api/plants?search=kutch").get_json()["count"] == 1

    assert client.get("/api/plants/NOPE").status_code == 404
    r = client.get("/api/plants/GEN-001?days=30")
    body = r.get_json()
    assert r.status_code == 200 and body["plant"]["plant_id"] == "GEN-001"
    assert len(body["series"]) == 30 and body["series"][-1]["actual_kwh"] > 0
    assert body["kpis"]["generation_days"] == 64 and body["kpis"]["capacity_factor_pct"] > 0
    assert body["monthly_generation"] and body["weather"] is not None
    assert client.get("/api/plants/GEN-001?days=abc").status_code == 200

    assert (
        client.post("/api/plants/GEN-001/status", json={"status": "weird"}, headers=_auth(tokens["gov"])).status_code
        == 422
    )
    assert (
        client.post("/api/plants/NOPE/status", json={"status": "suspended"}, headers=_auth(tokens["gov"])).status_code
        == 404
    )
    r = client.post("/api/plants/GEN-001/status", json={"status": "under_review"}, headers=_auth(tokens["gov"]))
    assert r.status_code == 200 and r.get_json()["plant"]["status"] == "under_review"
    assert (
        client.get("/api/plants/GEN-001/weather?start=2026-08-01&end=2026-08-05").get_json()["weather"].__len__() == 5
    )
    assert client.get("/api/plants/NOPE/weather").status_code == 404


def test_institutions(client, world, tokens):
    r = client.get("/api/institutions")
    assert r.status_code == 200 and r.get_json()["count"] == 2
    assert client.get("/api/institutions?search=green").get_json()["count"] == 1
    assert (
        client.post(
            "/api/institutions", json={"institution_id": "INST-9", "name": "Nine"}, headers=_auth(tokens["inst"])
        ).status_code
        == 403
    )
    assert client.post("/api/institutions", json={"name": "Nine"}, headers=_auth(tokens["gov"])).status_code == 422
    r = client.post(
        "/api/institutions",
        json={"institution_id": "INST-9", "name": "Nine", "sector": "Retail"},
        headers=_auth(tokens["gov"]),
    )
    assert r.status_code == 201 and r.get_json()["institution"]["sector"] == "Retail"
    r = client.get("/api/institutions/INST-045")
    assert r.status_code == 200 and r.get_json()["institution"]["name"] == "Acme Steel" and "kpis" in r.get_json()
    assert client.get("/api/institutions/NOPE").status_code == 404


# ── generation ─────────────────────────────────────────────


def test_generation_submit_scoping_and_get(client, world, tokens):
    rows = [
        {"date": "2026-09-01", "generation_kwh": 18400, "meter_reading_kwh": 1284400, "operating_hours": 11.5},
        {"date": "2026-09-02", "generation_kwh": 17900},
    ]
    r = client.post("/api/generation", json={"plant_id": "GEN-001", "rows": rows}, headers=_auth(tokens["gen"]))
    assert r.status_code == 201, r.get_json()
    assert r.get_json()["rows"] == 2 and r.get_json()["first_date"] == "2026-09-01"
    assert client.post("/api/generation", json={"plant_id": "NOPE", "rows": rows}).status_code == 404
    registry.upsert_plant({**PLANT, "plant_id": "GEN-002", "name": "Other"})
    assert (
        client.post(
            "/api/generation", json={"plant_id": "GEN-002", "rows": rows}, headers=_auth(tokens["gen"])
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/generation", json={"plant_id": "GEN-002", "rows": rows}, headers=_auth(tokens["gov"])
        ).status_code
        == 201
    )
    r = client.post(
        "/api/generation",
        json={"plant_id": "GEN-001", "rows": [{"date": "bad", "generation_kwh": 1}]},
        headers=_auth(tokens["gen"]),
    )
    assert r.status_code == 422 and r.get_json()["details"]
    assert client.post("/api/generation", json={"plant_id": "GEN-001", "rows": []}).status_code == 422
    # single manual entry shape
    r = client.post(
        "/api/generation",
        json={"plant_id": "GEN-001", "date": "2026-09-03", "generation_kwh": 16000, "hour": ""},
        headers=_auth(tokens["gen"]),
    )
    assert r.status_code == 201 and r.get_json()["rows"] == 1

    r = client.get("/api/generation/GEN-001?start=2026-09-01&end=2026-09-03")
    body = r.get_json()
    assert r.status_code == 200 and body["count"] == 3 and body["stats"]["total_kwh"] == 18400 + 17900 + 16000
    assert "predicted_kwh" in body["rows"][0] and body["monthly"]
    assert client.get("/api/generation/NOPE").status_code == 404
    assert client.get("/api/generation/GEN-001?limit=abc").status_code == 200

    r = client.get("/api/generation/GEN-001/template.csv")
    assert r.status_code == 200 and r.data.startswith(b"Date,Time,Generation")
    assert client.get("/api/generation/stats/summary").get_json()["counts"]["plants"] == 2
    assert (
        client.get("/api/generation/stats/summary", headers=_auth(tokens["gen"])).get_json()["plants"][0]["days"] >= 60
    )


def test_generation_csv_upload(client, world, tokens):
    csv = "Date,Time,Generation,Meter Reading,Operating Hours\n2026-09-05,,18400,1284400,11.5\n2026-09-06,,17200,1301600,11.2\n"
    data = {"plant_id": "GEN-001", "file": (io.BytesIO(csv.encode()), "gen.csv")}
    r = client.post(
        "/api/generation/upload", data=data, content_type="multipart/form-data", headers=_auth(tokens["gen"])
    )
    assert r.status_code == 201, r.get_json()
    assert r.get_json()["rows"] == 2 and r.get_json()["last_date"] == "2026-09-06"
    rows = client.get("/api/generation/GEN-001?start=2026-09-05&end=2026-09-06").get_json()["rows"]
    assert rows[0]["source"] == "csv" and rows[0]["meter_reading_kwh"] == 1284400 and rows[0]["operating_hours"] == 11.5
    assert (
        client.post(
            "/api/generation/upload", data={"plant_id": "GEN-001"}, content_type="multipart/form-data"
        ).status_code
        == 400
    )
    assert (
        client.post("/api/generation/upload", data={"plant_id": "NOPE"}, content_type="multipart/form-data").status_code
        == 404
    )
    bad = {"plant_id": "GEN-001", "file": (io.BytesIO(b"nothing,here\n"), "x.csv")}
    assert client.post("/api/generation/upload", data=bad, content_type="multipart/form-data").status_code == 422
    registry.upsert_plant({**PLANT, "plant_id": "GEN-002", "name": "Other"})
    other = {"plant_id": "GEN-002", "file": (io.BytesIO(csv.encode()), "gen.csv")}
    assert (
        client.post(
            "/api/generation/upload", data=other, content_type="multipart/form-data", headers=_auth(tokens["gen"])
        ).status_code
        == 403
    )


# ── prediction / ML ────────────────────────────────────────


def test_prediction_and_ml_endpoints(client, world):
    r = client.post(
        "/api/prediction/generation", json={"plant_id": "GEN-001", "period_start": AUG[0], "period_end": AUG[1]}
    )
    body = r.get_json()
    assert (
        r.status_code == 200
        and body["prediction"]["days"] == 31
        and body["prediction"]["actual_kwh"] == pytest.approx(world["actual"])
    )
    assert abs(body["prediction"]["expected_kwh"] - world["actual"]) / world["actual"] < 0.15
    r = client.post("/api/prediction/generation", json={"plant_id": "GEN-001", "date": "2026-08-10"})
    assert r.status_code == 200 and r.get_json()["prediction"]["predicted_kwh"] > 0
    assert client.post("/api/prediction/generation", json={"plant_id": "NOPE"}).status_code == 404
    assert (
        client.post(
            "/api/prediction/generation", json={"plant_id": "GEN-001", "period_start": AUG[1], "period_end": AUG[0]}
        ).status_code
        == 422
    )
    assert client.post("/api/prediction/generation", json={"plant_id": "GEN-001"}).status_code == 422

    r = client.get("/api/prediction/forecast/GEN-001")
    assert r.status_code == 200 and [f["horizon_hours"] for f in r.get_json()["forecast"]] == [24, 48, 72]
    assert [
        f["horizon_hours"] for f in client.get("/api/prediction/forecast/GEN-001?horizons=24,48").get_json()["forecast"]
    ] == [24, 48]
    assert client.get("/api/prediction/forecast/GEN-001?horizons=x").get_json()["forecast"][0]["horizon_hours"] == 24
    assert client.get("/api/prediction/forecast/NOPE").status_code == 404

    info = client.get("/api/ml/model").get_json()["model"]
    assert info["version"] and info["metrics"]["r2"] > 0.85 and info["feature_importance"]
    assert (
        client.post("/api/ml/predict-generation", json={"plant_id": "GEN-001", "date": "2026-08-11"}).status_code == 200
    )
    r = client.post(
        "/api/ml/anomaly-score",
        json={"claimed_kwh": 890000, "expected_kwh": 620000, "lower_kwh": 600000, "upper_kwh": 650000},
    )
    assert r.status_code == 200 and r.get_json()["anomaly"]["level"] == "HIGH"
    assert client.post("/api/ml/anomaly-score", json={"claimed_kwh": "x"}).status_code == 422
    r = client.post(
        "/api/ml/fraud-score",
        json={
            "claimed_kwh": 890000,
            "expected_kwh": 620000,
            "actual_kwh": 605000,
            "capacity_mw": 5,
            "period_days": 31,
            "historical_expected_kwh": 600000,
            "certificate_status": "VALID",
        },
    )
    assert r.status_code == 200 and r.get_json()["risk"]["risk_level"] == "CRITICAL"
    assert client.post("/api/ml/fraud-score", json={}).status_code == 422


# ── claims ─────────────────────────────────────────────────


def test_claim_submission_pipeline(client, world, tokens, tmp_path):
    actual = world["actual"]
    path = _issue("REC-001", actual)
    fields = {
        "plant_id": "GEN-001",
        "cert_id": "REC-001",
        "period_start": AUG[0],
        "period_end": AUG[1],
        "claimed_kwh": actual * 0.99,
        "transaction_id": "TXN-1",
    }
    r = _claim(client, tokens["inst"], fields, path)
    assert r.status_code == 201, r.get_json()
    c = r.get_json()["claim"]
    assert c["institution_id"] == "INST-045" and c["status"] == "verified" and c["certificate_status"] == "VALID"
    assert c["certificate_file_path"].startswith(str(tmp_path)) or "uploads" in c["certificate_file_path"]
    assert ledger.lookup_certificate("REC-001")["status"] == "claimed"

    # inflated → flagged + investigation
    path2 = _issue("REC-1022", actual)
    r = _claim(
        client, tokens["inst"], {**fields, "cert_id": "REC-1022", "claimed_kwh": 890000, "transaction_id": ""}, path2
    )
    flagged = r.get_json()["claim"]
    assert (
        r.status_code == 201
        and flagged["status"] == "flagged"
        and flagged["risk_level"] == "CRITICAL"
        and flagged["case_id"]
    )

    # tampered file
    path3 = _issue("REC-002", 100.0, "2026-08-10")
    bad = _tamper(path3, str(tmp_path / "REC-002_T.png"), energy_kwh=1000.0)
    r = _claim(
        client,
        tokens["inst"],
        {**fields, "cert_id": "REC-002", "period_start": "2026-08-10", "period_end": "2026-08-10", "claimed_kwh": 1000},
        bad,
    )
    t = r.get_json()["claim"]
    assert t["certificate_status"] == "TAMPERED" and t["risk_level"] == "CRITICAL" and t["status"] == "flagged"

    # duplicate: REC-001 already claimed → second institution rejected
    r = _claim(client, tokens["inst2"], fields, path)
    d = r.get_json()["claim"]
    assert (
        r.status_code == 201
        and d["status"] == "rejected"
        and d["certificate_status"] == "DUPLICATE"
        and d["institution_id"] == "INST-042"
    )

    # JSON body as government with explicit institution_id, no file
    _issue("REC-006", actual)
    r = client.post(
        "/api/claims", json={**fields, "cert_id": "REC-006", "institution_id": "INST-042"}, headers=_auth(tokens["gov"])
    )
    assert r.status_code == 201 and r.get_json()["claim"]["certificate_status"] == "NOT_PROVIDED"

    # validation / errors
    r = client.post("/api/claims", json={"plant_id": "GEN-001"}, headers=_auth(tokens["inst"]))
    assert r.status_code == 422 and len(r.get_json()["details"]) >= 3
    assert (
        client.post("/api/claims", json={**fields, "plant_id": "NOPE"}, headers=_auth(tokens["inst"])).status_code
        == 404
    )
    assert client.post("/api/claims", json=fields).status_code == 422  # anonymous: no institution
    assert client.post("/api/claims", json={**fields, "institution_id": "NOPE"}).status_code == 404
    assert (
        _claim(
            client,
            tokens["inst"],
            fields,
            __file__,
        ).status_code
        == 415
    )  # .py upload
    assert (
        client.post(
            "/api/claims",
            data=_multipart(fields) | {"file": (io.BytesIO(b"junk"), "c.png")},
            content_type="multipart/form-data",
            headers=_auth(tokens["inst"]),
        ).status_code
        == 415
    )


def test_claims_listing_scoping_detail_decision(client, world, tokens):
    actual = world["actual"]
    p1 = _issue("REC-010", actual)
    _claim(
        client,
        tokens["inst"],
        {
            "plant_id": "GEN-001",
            "cert_id": "REC-010",
            "period_start": AUG[0],
            "period_end": AUG[1],
            "claimed_kwh": actual,
        },
        p1,
    )
    p2 = _issue("REC-011", actual)
    r = _claim(
        client,
        tokens["inst2"],
        {
            "plant_id": "GEN-001",
            "cert_id": "REC-011",
            "period_start": AUG[0],
            "period_end": AUG[1],
            "claimed_kwh": 900000,
        },
        p2,
    )
    flagged = r.get_json()["claim"]

    assert client.get("/api/claims", headers=_auth(tokens["gov"])).get_json()["total"] == 2
    assert client.get("/api/claims").get_json()["total"] == 2
    mine = client.get("/api/claims", headers=_auth(tokens["inst"])).get_json()
    assert mine["total"] == 1 and mine["claims"][0]["institution_id"] == "INST-045"
    assert (
        client.get("/api/claims?institution_id=INST-045", headers=_auth(tokens["inst2"])).get_json()["total"] == 1
    )  # scoped to own
    registry.upsert_plant({**PLANT, "plant_id": "GEN-002", "name": "Other"})
    assert (
        client.get("/api/claims", headers=_auth(tokens["gen"])).get_json()["total"] == 2
    )  # both claims are on GEN-001
    assert client.get("/api/claims?status=flagged").get_json()["total"] == 1
    assert client.get("/api/claims?risk_level=critical").get_json()["claims"][0]["claim_id"] == flagged["claim_id"]
    assert client.get("/api/claims?search=greentech").get_json()["total"] == 1
    assert (
        client.get("/api/claims?min_risk=50&order=risk_score DESC").get_json()["claims"][0]["claim_id"]
        == flagged["claim_id"]
    )
    assert (
        client.get("/api/claims?limit=1&offset=1").get_json()["count"]
        if "count" in client.get("/api/claims?limit=1&offset=1").get_json()
        else True
    )
    page = client.get("/api/claims?limit=1&offset=1").get_json()
    assert len(page["claims"]) == 1 and page["total"] == 2
    assert client.get("/api/claims?limit=x").status_code == 400

    # detail
    r = client.get(f"/api/claims/{flagged['claim_id']}", headers=_auth(tokens["gov"]))
    body = r.get_json()
    assert (
        r.status_code == 200
        and body["claim"]["fraud_score"]["findings"]
        and body["audit"][0]["action"] == "Claim submitted"
    )
    assert body["evidence"] and len(body["evidence"]["predictions"]) >= 31 and body["investigation"]["status"] == "open"
    assert body["plant"]["plant_id"] == "GEN-001" and body["institution"]["institution_id"] == "INST-042"
    assert client.get(f"/api/claims/{flagged['claim_id']}", headers=_auth(tokens["inst"])).status_code == 403
    assert client.get(f"/api/claims/{flagged['claim_id']}", headers=_auth(tokens["inst2"])).status_code == 200
    assert client.get("/api/claims/NOPE").status_code == 404
    assert client.get(f"/api/claims/{flagged['claim_id']}/audit").get_json()["events"]
    assert client.get("/api/claims/NOPE/audit").status_code == 404

    # decisions
    url = f"/api/claims/{flagged['claim_id']}/decision"
    assert client.post(url, json={"decision": "reject"}, headers=_auth(tokens["inst2"])).status_code == 403
    assert client.post(url, json={"decision": "reject"}).status_code == 401
    assert client.post(url, json={"decision": "maybe"}, headers=_auth(tokens["gov"])).status_code == 422
    r = client.post(url, json={"decision": "request_evidence", "note": "meter logs"}, headers=_auth(tokens["gov"]))
    assert r.status_code == 200 and r.get_json()["claim"]["status"] == "evidence_requested"
    r = client.post(url, json={"decision": "approve", "note": "ok"}, headers=_auth(tokens["gov"]))
    assert r.status_code == 200 and r.get_json()["claim"]["status"] == "approved"
    assert ledger.lookup_certificate("REC-011")["claimed_by"] == "INST-042"
    assert client.post(url, json={"decision": "reject"}, headers=_auth(tokens["gov"])).status_code == 422
    assert (
        client.post("/api/claims/NOPE/decision", json={"decision": "reject"}, headers=_auth(tokens["gov"])).status_code
        == 404
    )


# ── certificates / REC issuer / REC verifier ───────────────


def test_certificates_endpoints(client, world, tokens, tmp_path):
    actual = world["actual"]
    path = _issue("REC-020", actual)
    _claim(
        client,
        tokens["inst"],
        {
            "plant_id": "GEN-001",
            "cert_id": "REC-020",
            "period_start": AUG[0],
            "period_end": AUG[1],
            "claimed_kwh": actual,
        },
        path,
    )
    _issue("REC-021", actual)

    r = client.get("/api/certificates")
    body = r.get_json()
    assert r.status_code == 200 and body["count"] == 2
    by_id = {c["cert_id"]: c for c in body["certificates"]}
    assert (
        by_id["REC-020"]["final_status"] == "CLAIMED"
        and by_id["REC-020"]["security"]["last_result"] == "VALID"
        and by_id["REC-020"]["claims"]
    )
    assert by_id["REC-021"]["final_status"] == "VALID" and by_id["REC-021"]["plant_name"] == "Kutch Solar Park A"
    assert "signature" not in by_id["REC-021"]
    assert client.get("/api/certificates?search=021").get_json()["count"] == 1
    assert client.get("/api/certificates?status=claimed").get_json()["count"] == 1

    r = client.get("/api/certificates/REC-020")
    body = r.get_json()
    assert (
        r.status_code == 200
        and body["checks"]["hash"] == "MATCH"
        and body["checks"]["rsa"] == "VALID"
        and body["checks"]["claim"] == "CLAIMED"
    )
    assert body["final_status"] == "CLAIMED" and body["reconciliation"]["status"] in ("CONSISTENT", "INCONSISTENT")
    assert body["reconciliation"]["window_days"] > 1 and body["institution_id"] == "INST-045" and body["audit"]
    assert client.get("/api/certificates/REC-021").get_json()["checks"]["hash"] == "NOT CHECKED"
    r = client.get("/api/certificates/NOPE")
    assert r.status_code == 404 and r.get_json()["final_status"] == "NOT FOUND"

    r = client.post("/api/certificates/REC-021/verify")
    assert r.status_code == 200 and r.get_json()["status"] == "NOT_PROVIDED" and r.get_json()["final_status"] == "VALID"
    r = client.post(
        "/api/certificates/REC-021/verify",
        data={"file": (open(_issue("REC-022", actual), "rb"), "c.png")},
        content_type="multipart/form-data",
    )
    assert r.get_json()["status"] == "ID_TAMPERED" and r.get_json()["final_status"] == "TAMPERED"
    r = client.post(
        "/api/certificates/REC-021/verify",
        data={"file": (io.BytesIO(b"no"), "c.txt")},
        content_type="multipart/form-data",
    )
    assert r.status_code == 415
    r = client.post(
        "/api/certificates/REC-021/verify",
        data={"file": (io.BytesIO(b"no"), "c.png")},
        content_type="multipart/form-data",
    )
    assert r.status_code == 415


def test_rec_issue(client, world, tokens):
    body = {
        "certificate_id": "REC-030",
        "generator_id": "GEN-001",
        "energy_kwh": 100,
        "generation_date": "2026-08-10",
        "generation_period": "2026-08-10",
        "energy_type": "Solar",
    }
    r = client.post("/api/rec/issue", json=body, headers=_auth(tokens["issuer"]))
    out = r.get_json()
    assert r.status_code == 201, out
    assert (
        out["cert_id"] == "REC-030"
        and len(out["hash"]) == 64
        and out["signature"] == "VALID"
        and out["ledger"] == "REGISTERED"
    )
    assert (
        out["claim_status"] == "NOT CLAIMED"
        and len(out["steps"]) == 6
        and all(s["status"] == "done" for s in out["steps"])
    )
    assert out["download_url"].endswith("REC-030.png")
    assert ledger.lookup_certificate("REC-030")["issuer_id"] == "issuer@greenshield.gov"
    assert client.post("/api/rec/issue", json=body).status_code == 400  # duplicate id
    assert client.post("/api/rec/issue", json={"generator_id": "GEN-001"}).status_code == 422
    r = client.post(
        "/api/rec/issue", json={"generator_id": "GEN-001", "energy_kwh": 50, "generation_date": "2026-08-11"}
    )
    assert r.status_code == 201 and r.get_json()["cert_id"].startswith("REC-SLR-")
    assert client.get("/api/audit?cert_id=REC-030").get_json()["events"][0]["action"] == "REC issued"


def test_rec_verify_four_steps(client, world, tokens, tmp_path):
    actual = world["actual"]

    def verify(path, name="c.png"):
        return client.post(
            "/api/rec/verify", data={"file": (open(path, "rb"), name)}, content_type="multipart/form-data"
        )

    valid = _issue("REC-040", actual)
    r = verify(valid)
    body = r.get_json()
    assert r.status_code == 200 and body["final_result"] == "VALID" and body["cert_id"] == "REC-040"
    assert [s["status"] for s in body["steps"][:3]] == ["pass", "pass", "pass"]
    assert (
        body["summary"]["hash"] == "MATCH"
        and body["summary"]["rsa"] == "VALID"
        and body["summary"]["ledger"] == "REGISTERED"
    )
    assert body["summary"]["claimed"] == "NO" and body["summary"]["generation"] in ("CONSISTENT", "UNKNOWN")
    assert body["reconciliation"]["status"] == "CONSISTENT" and body["steps"][3]["status"] == "pass"

    tampered = _tamper(valid, str(tmp_path / "t.png"), energy_kwh=actual * 3)
    body = verify(tampered).get_json()
    assert (
        body["final_result"] == "TAMPERED"
        and body["summary"]["hash"] == "MISMATCH"
        and body["steps"][0]["status"] == "fail"
    )
    assert body["certificate_status"] == "TAMPERED"

    assert ledger.mark_claimed("REC-040", "INST-045")
    body = verify(valid).get_json()
    assert body["final_result"] == "DUPLICATE" and body["summary"]["claimed"] == "YES" and "CLAIMED" in body["headline"]

    orig = _issue("REC-041", actual)
    relabelled = _tamper(orig, str(tmp_path / "r.png"), cert_id="REC-999")
    body = verify(relabelled).get_json()
    assert body["final_result"] == "TAMPERED" and body["certificate_status"] == "ID_TAMPERED"
    assert body["original_record"]["cert_id"] == "REC-041" and "ID tampering" in body["headline"]

    plain = tmp_path / "plain.png"
    Image.new("RGB", (300, 200), (255, 255, 255)).save(plain)
    body = verify(str(plain)).get_json()
    assert body["final_result"] == "TAMPERED" and body["cert_id"] is None and body["steps"][1]["status"] == "skipped"

    inflated = _issue("REC-042", actual * 2.5)
    body = verify(inflated).get_json()
    assert (
        body["final_result"] == "INCONSISTENT"
        and body["reconciliation"]["status"] == "INCONSISTENT"
        and body["steps"][3]["status"] == "fail"
    )

    assert client.post("/api/rec/verify", data={}, content_type="multipart/form-data").status_code == 400
    assert verify(__file__, "x.py").status_code == 415
    assert (
        client.post(
            "/api/rec/verify", data={"file": (io.BytesIO(b"junk"), "c.png")}, content_type="multipart/form-data"
        ).status_code
        == 415
    )

    assert client.post("/api/rec/revoke/REC-041", headers=_auth(tokens["inst"])).status_code == 403
    r = client.post("/api/rec/revoke/REC-041", json={"reason": "fraud"}, headers=_auth(tokens["gov"]))
    assert r.status_code == 200 and ledger.lookup_certificate("REC-041")["status"] == "revoked"
    assert client.post("/api/rec/revoke/REC-041", headers=_auth(tokens["issuer"])).status_code == 400
    body = verify(orig).get_json()
    assert body["final_result"] == "REVOKED"


# ── fraud ──────────────────────────────────────────────────


def test_fraud_endpoints(client, world, tokens):
    actual = world["actual"]
    r = client.post(
        "/api/fraud/analyze",
        json={
            "plant_id": "GEN-001",
            "period_start": AUG[0],
            "period_end": AUG[1],
            "claimed_kwh": 890000,
            "certificate_status": "valid",
        },
    )
    body = r.get_json()
    assert (
        r.status_code == 200
        and body["risk"]["risk_level"] == "CRITICAL"
        and body["actual_kwh"] == pytest.approx(actual)
        and "daily" not in body["ai"]
    )
    assert client.post("/api/fraud/analyze", json={"plant_id": "NOPE"}).status_code == 404
    assert client.post("/api/fraud/analyze", json={"plant_id": "GEN-001", "claimed_kwh": "x"}).status_code == 422

    assert client.get("/api/fraud/alerts").get_json()["alerts"] == []
    p1 = _issue("REC-050", actual)
    _claim(
        client,
        tokens["inst"],
        {
            "plant_id": "GEN-001",
            "cert_id": "REC-050",
            "period_start": AUG[0],
            "period_end": AUG[1],
            "claimed_kwh": 900000,
        },
        p1,
    )
    p2 = _issue("REC-051", actual)
    _claim(
        client,
        tokens["inst2"],
        {
            "plant_id": "GEN-001",
            "cert_id": "REC-051",
            "period_start": AUG[0],
            "period_end": AUG[1],
            "claimed_kwh": actual,
        },
        p2,
    )
    alerts = client.get("/api/fraud/alerts?limit=5").get_json()["alerts"]
    assert (
        len(alerts) == 1 and "above expected generation" in alerts[0]["text"] and alerts[0]["risk_level"] == "CRITICAL"
    )

    net = client.get("/api/fraud/network").get_json()
    assert {n["kind"] for n in net["nodes"]} == {"plant", "institution"} and len(net["edges"]) == 2
    edge = {e["source"]: e for e in net["edges"]}
    assert (
        edge["INST-045"]["suspicious"] is True
        and edge["INST-045"]["relationship"] == "Potentially Suspicious Relationship"
    )
    assert edge["INST-042"]["suspicious"] is False and edge["INST-042"]["certificates"] == ["REC-051"]
    assert "not findings of collusion" in net["disclaimer"]

    prof = client.get("/api/fraud/network/plant/GEN-001").get_json()
    assert (
        prof["claims"] == 2
        and prof["flagged_claims"] == 1
        and sorted(prof["counterparties"]) == ["INST-042", "INST-045"]
        and prof["risk_history"]
    )
    prof = client.get("/api/fraud/network/institution/INST-045").get_json()
    assert prof["certificates"] == ["REC-050"] and prof["counterparties"] == ["GEN-001"]
    assert client.get("/api/fraud/network/plant/NOPE").status_code == 404
    assert client.get("/api/fraud/network/thing/GEN-001").status_code == 404


# ── investigations ─────────────────────────────────────────


def test_investigations(client, world, tokens):
    actual = world["actual"]
    p = _issue("REC-060", actual)
    r = _claim(
        client,
        tokens["inst"],
        {
            "plant_id": "GEN-001",
            "cert_id": "REC-060",
            "period_start": AUG[0],
            "period_end": AUG[1],
            "claimed_kwh": 900000,
        },
        p,
    )
    case_id = r.get_json()["claim"]["case_id"]
    assert client.get("/api/investigations").status_code == 401
    assert client.get("/api/investigations", headers=_auth(tokens["inst"])).status_code == 403
    body = client.get("/api/investigations", headers=_auth(tokens["gov"])).get_json()
    assert (
        body["stats"]["open"] == 1
        and body["cases"][0]["case_id"] == case_id
        and body["cases"][0]["plant_name"] == "Kutch Solar Park A"
    )
    assert (
        client.get("/api/investigations?status=resolved_rejected", headers=_auth(tokens["gov"])).get_json()["cases"]
        == []
    )
    r = client.get(f"/api/investigations/{case_id}", headers=_auth(tokens["gov"]))
    case = r.get_json()["case"]
    assert (
        r.status_code == 200
        and case["claim"]["claim_id"]
        and case["evidence"]["ai"]["findings"]
        and case["audit"]
        and case["plant"]
    )
    assert client.get("/api/investigations/NOPE", headers=_auth(tokens["gov"])).status_code == 404
    assert (
        client.post(
            f"/api/investigations/{case_id}/decision", json={"decision": "reject"}, headers=_auth(tokens["inst"])
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/investigations/{case_id}/decision", json={"decision": "nope"}, headers=_auth(tokens["gov"])
        ).status_code
        == 422
    )
    r = client.post(
        f"/api/investigations/{case_id}/decision",
        json={"decision": "reject", "note": "Inflated"},
        headers=_auth(tokens["gov"]),
    )
    assert (
        r.status_code == 200
        and r.get_json()["claim"]["status"] == "rejected"
        and r.get_json()["case"]["status"] == "resolved_rejected"
    )
    assert (
        client.post(
            "/api/investigations/NOPE/decision", json={"decision": "reject"}, headers=_auth(tokens["gov"])
        ).status_code
        == 404
    )
    assert client.get("/api/investigations", headers=_auth(tokens["gov"])).get_json()["stats"]["resolved_rejected"] == 1


# ── audit ──────────────────────────────────────────────────


def test_audit_endpoints(client, world, tokens):
    actual = world["actual"]
    p = _issue("REC-070", actual)
    r = _claim(
        client,
        tokens["inst"],
        {
            "plant_id": "GEN-001",
            "cert_id": "REC-070",
            "period_start": AUG[0],
            "period_end": AUG[1],
            "claimed_kwh": actual,
            "transaction_id": "TXN-70",
        },
        p,
    )
    cid = r.get_json()["claim"]["claim_id"]
    body = client.get("/api/audit?limit=5").get_json()
    assert body["count"] == 5 and body["chain"]["valid"] is True and body["events"][0]["id"] > body["events"][1]["id"]
    assert client.get(f"/api/audit?claim_id={cid}").get_json()["events"][-1]["action"] == "Claim submitted"
    assert client.get("/api/audit?cert_id=REC-070").get_json()["count"] > 0
    assert client.get("/api/audit?limit=x").status_code == 200
    assert client.get("/api/audit/verify").get_json()["valid"] is True
    assert client.get("/api/audit/TXN-70").get_json()["events"][0]["action"] == "Claim submitted"
    assert client.get(f"/api/audit/{cid}").get_json()["reference"] == cid
    assert client.get("/api/audit/REC-070").status_code == 200
    assert client.get("/api/audit/NOPE").status_code == 404


# ── dashboards / analytics ─────────────────────────────────


def test_dashboards(client, world, tokens):
    actual = world["actual"]
    p1 = _issue("REC-080", actual)
    _claim(
        client,
        tokens["inst"],
        {
            "plant_id": "GEN-001",
            "cert_id": "REC-080",
            "period_start": AUG[0],
            "period_end": AUG[1],
            "claimed_kwh": actual,
            "transaction_id": "TXN-80",
        },
        p1,
    )
    registry.upsert_transaction(
        {
            "transaction_id": "TXN-80",
            "cert_id": "REC-080",
            "seller_plant_id": "GEN-001",
            "buyer_institution_id": "INST-045",
            "energy_kwh": actual,
        }
    )
    p2 = _issue("REC-081", actual)
    _claim(
        client,
        tokens["inst2"],
        {
            "plant_id": "GEN-001",
            "cert_id": "REC-081",
            "period_start": AUG[0],
            "period_end": AUG[1],
            "claimed_kwh": 900000,
        },
        p2,
    )

    assert client.get("/api/dashboard/government").status_code == 401
    assert client.get("/api/dashboard/government", headers=_auth(tokens["inst"])).status_code == 403
    r = client.get("/api/dashboard/government", headers=_auth(tokens["gov"]))
    g = r.get_json()
    assert r.status_code == 200
    assert (
        g["kpis"]["registered_plants"] == 1
        and g["kpis"]["active_claims"] == 2
        and g["kpis"]["critical_risk"] == 1
        and g["kpis"]["certificates_issued"] == 2
    )
    assert g["verification_overview"]["verified"] == 1 and g["verification_overview"]["flagged"] == 1
    assert (
        g["comparison"]["totals"]["claimed_kwh"] == pytest.approx(actual + 900000)
        and g["comparison"]["by_month"][0]["month"] == "2026-08"
    )
    assert g["comparison"]["top_claims"][0]["risk_level"] == "CRITICAL" and g["risk_distribution"]["CRITICAL"] == 1
    assert g["recent_high_risk"][0]["cert_id"] == "REC-081" and g["alerts"][0]["cert_id"] == "REC-081"
    assert g["investigations"]["open"] == 1 and g["recent_audit"] and g["audit_chain"]["valid"]

    assert client.get("/api/dashboard/generator/GEN-001").status_code == 200
    registry.upsert_plant({**PLANT, "plant_id": "GEN-002", "name": "Other"})
    assert client.get("/api/dashboard/generator/GEN-002", headers=_auth(tokens["gen"])).status_code == 403
    assert client.get("/api/dashboard/generator/NOPE", headers=_auth(tokens["gov"])).status_code == 404
    gd = client.get("/api/dashboard/generator/GEN-001", headers=_auth(tokens["gen"])).get_json()
    assert (
        gd["today"]["generation_kwh"] > 0
        and gd["today"]["expected"]["predicted_kwh"] > 0
        and gd["today"]["status"] in ("NORMAL", "WATCH", "ANOMALY")
    )
    assert (
        len(gd["series_30d"]) == 30
        and [f["horizon_hours"] for f in gd["forecast"]] == [24, 48, 72]
        and gd["stats"]["total_claims"] == 2
    )

    assert client.get("/api/dashboard/institution/INST-042", headers=_auth(tokens["inst"])).status_code == 403
    assert client.get("/api/dashboard/institution/NOPE").status_code == 404
    idb = client.get("/api/dashboard/institution/INST-045", headers=_auth(tokens["inst"])).get_json()
    assert (
        idb["kpis"]["total_claims"] == 1
        and idb["kpis"]["verified_energy_kwh"] == pytest.approx(actual)
        and idb["kpis"]["total_purchased_energy_kwh"] == pytest.approx(actual)
    )
    assert (
        idb["certificates"][0]["final_status"] == "VALID"
        and idb["certificates"][0]["hash_status"] == "MATCH"
        and idb["transactions"][0]["transaction_id"] == "TXN-80"
    )

    assert client.get("/api/dashboard/me").status_code == 401
    assert client.get("/api/dashboard/me", headers=_auth(tokens["gov"])).get_json()["role"] == "government"
    assert client.get("/api/dashboard/me", headers=_auth(tokens["gen"])).get_json()["plant"]["plant_id"] == "GEN-001"
    assert (
        client.get("/api/dashboard/me", headers=_auth(tokens["inst"])).get_json()["institution"]["institution_id"]
        == "INST-045"
    )
    assert client.get("/api/dashboard/me", headers=_auth(tokens["issuer"])).status_code == 404

    assert client.get("/api/analytics/government", headers=_auth(tokens["inst"])).status_code == 403
    a = client.get(
        "/api/analytics/government?energy_type=Solar&state=Gujarat&date_from=2026-08-01&date_to=2026-08-31",
        headers=_auth(tokens["gov"]),
    ).get_json()
    assert a["total_claims"] == 2 and a["generation_by_month"] and a["claims_by_month"][0]["claims"] == 2
    assert (
        a["fraud_detection_rate_pct"] == 50.0 and a["risk_distribution"]["CRITICAL"] == 1 and a["states"] == ["Gujarat"]
    )
    assert (
        a["top_suspicious_generators"][0]["plant_id"] == "GEN-001"
        and a["top_suspicious_institutions"][0]["institution_id"] == "INST-042"
    )
    assert sum(b["claims"] for b in a["deviation_distribution"]) == 2
    assert (
        client.get("/api/analytics/government?energy_type=Wind", headers=_auth(tokens["gov"])).get_json()[
            "total_claims"
        ]
        == 0
    )
