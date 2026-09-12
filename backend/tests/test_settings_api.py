"""Runtime risk configuration endpoint."""

import pytest
from werkzeug.security import generate_password_hash

from app import create_app
from modules import ledger, settings
from modules.risk_engine import level_for, score_claim


@pytest.fixture
def app(isolated_env, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@test.io")
    monkeypatch.setenv("ADMIN_PASSWORD", "adminpass123")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-jwt-secret-that-is-at-least-32-bytes-long")
    monkeypatch.setenv("RISK_THRESHOLDS", "30,60,80")
    monkeypatch.setenv("RISK_WEIGHTS", "40,20,20,10,10")
    monkeypatch.setenv("AUTO_VERIFY_MAX_LEVEL", "MEDIUM")
    application = create_app({"TESTING": True})
    ledger.create_user("gov@test.io", generate_password_hash("Demo@1234"), role="government")
    ledger.create_user("buyer@test.io", generate_password_hash("Demo@1234"), role="institution", entity_id="INST-1")
    return application


@pytest.fixture
def client(app):
    return app.test_client()


def _token(client, email):
    return client.post("/api/auth/login", json={"email": email, "password": "Demo@1234"}).get_json()["access_token"]


def test_get_current_settings(client):
    r = client.get("/api/settings/risk")
    assert r.status_code == 200
    body = r.get_json()
    assert body["thresholds"] == {"LOW": 30, "MEDIUM": 60, "HIGH": 80}
    assert body["weights"]["generation"] == 40 and body["auto_verify_max_level"] == "MEDIUM"
    assert body["model"]["version"]


def test_update_requires_government(client):
    h = {"Authorization": f"Bearer {_token(client, 'buyer@test.io')}"}
    assert (
        client.put(
            "/api/settings/risk", json={"thresholds": {"LOW": 10, "MEDIUM": 20, "HIGH": 30}}, headers=h
        ).status_code
        == 403
    )
    assert client.put("/api/settings/risk", json={}).status_code == 401


def test_update_validates(client):
    h = {"Authorization": f"Bearer {_token(client, 'gov@test.io')}"}
    bad = [
        {"thresholds": {"LOW": 60, "MEDIUM": 30, "HIGH": 80}},
        {"weights": {"generation": 50, "historical": 20, "weather": 20, "certificate": 10, "capacity": 10}},
        {"weights": {"generation": -5, "historical": 45, "weather": 20, "certificate": 20, "capacity": 20}},
        {"auto_verify_max_level": "CRITICAL"},
        {"thresholds": {"LOW": "x"}},
    ]
    for body in bad:
        r = client.put("/api/settings/risk", json=body, headers=h)
        assert r.status_code == 422, body


def test_update_applies_persists_and_reloads(client):
    h = {"Authorization": f"Bearer {_token(client, 'gov@test.io')}"}
    r = client.put(
        "/api/settings/risk",
        json={
            "thresholds": {"LOW": 20, "MEDIUM": 50, "HIGH": 75},
            "weights": {"generation": 50, "historical": 20, "weather": 10, "certificate": 10, "capacity": 10},
            "auto_verify_max_level": "LOW",
        },
        headers=h,
    )
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body["thresholds"] == {"LOW": 20, "MEDIUM": 50, "HIGH": 75} and body["updated_by"] == "gov@test.io"
    # the engine uses the new configuration immediately
    assert level_for(60) == "HIGH" and level_for(76) == "CRITICAL"
    assert (
        score_claim(
            claimed_kwh=890_000,
            expected_kwh=620_000,
            actual_kwh=None,
            capacity_mw=5,
            period_days=31,
            certificate_status="VALID",
        )["components"]["generation"]
        == 50
    )
    assert client.get("/api/settings/risk").get_json()["auto_verify_max_level"] == "LOW"
    assert any(e["action"] == "Risk configuration updated" for e in client.get("/api/audit").get_json()["events"])
    # persisted: clearing the environment and reloading restores the values
    import os

    os.environ["RISK_THRESHOLDS"] = "30,60,80"
    assert settings.load_persisted() == 3
    assert level_for(60) == "HIGH"
    # reset
    r = client.post("/api/settings/risk/reset", headers=h)
    assert r.status_code == 200 and r.get_json()["thresholds"] == {"LOW": 30, "MEDIUM": 60, "HIGH": 80}
    assert settings.load_persisted() == 0
