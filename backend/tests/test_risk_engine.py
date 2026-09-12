"""Transparent risk score: rules + AI + crypto → 0–100."""

import pytest

from modules.risk_engine import level_for, score_claim


def test_case_a_inflated_generation_is_critical():
    r = score_claim(
        claimed_kwh=890_000,
        expected_kwh=620_000,
        actual_kwh=605_000,
        capacity_mw=5,
        period_days=31,
        historical_expected_kwh=600_000,
        expected_upper_kwh=650_000,
        certificate_status="VALID",
        energy_type="Solar",
    )
    assert r["risk_level"] == "CRITICAL" and r["total_score"] >= 81
    assert r["components"]["generation"] == 40
    assert r["components"]["certificate"] == 0
    assert r["fraud_type"] == "inflated_generation"
    texts = " ".join(f["text"] for f in r["findings"])
    assert "43.5% above AI expected" in texts and "historical" in texts and "metered" in texts
    assert r["findings"][0]["severity"] == "HIGH"


def test_honest_claim_is_low():
    r = score_claim(
        claimed_kwh=600_000,
        expected_kwh=620_000,
        actual_kwh=605_000,
        capacity_mw=5,
        period_days=31,
        historical_expected_kwh=610_000,
        certificate_status="VALID",
    )
    assert r["risk_level"] == "LOW" and r["total_score"] <= 5
    assert r["fraud_type"] == "none"
    assert all(f["severity"] in ("OK",) for f in r["findings"])


@pytest.mark.parametrize(
    "status,fraud",
    [
        ("TAMPERED", "tampered_certificate"),
        ("ID_TAMPERED", "certificate_id_tampering"),
        ("DUPLICATE", "duplicate_claim"),
        ("NOT_FOUND", "unregistered_certificate"),
        ("REVOKED", "revoked_certificate"),
    ],
)
def test_certificate_problems_dominate_fraud_type(status, fraud):
    r = score_claim(
        claimed_kwh=600_000,
        expected_kwh=620_000,
        actual_kwh=605_000,
        capacity_mw=5,
        period_days=31,
        historical_expected_kwh=610_000,
        certificate_status=status,
    )
    assert r["fraud_type"] == fraud
    assert r["components"]["certificate"] >= 8
    if status in ("TAMPERED", "ID_TAMPERED", "DUPLICATE"):
        assert r["risk_level"] == "CRITICAL"  # crypto engine overrides the additive score
    else:
        assert r["risk_level"] in ("HIGH", "CRITICAL")


def test_missing_certificate_costs_a_little():
    r = score_claim(
        claimed_kwh=600_000,
        expected_kwh=620_000,
        actual_kwh=605_000,
        capacity_mw=5,
        period_days=31,
        certificate_status="NOT_PROVIDED",
    )
    assert r["components"]["certificate"] == 3


def test_physical_maximum_exceeded():
    r = score_claim(
        claimed_kwh=5_000_000,
        expected_kwh=600_000,
        actual_kwh=605_000,
        capacity_mw=5,
        period_days=31,
        certificate_status="VALID",
    )
    assert r["components"]["capacity"] == 10
    assert any("physical maximum" in f["text"] for f in r["findings"])
    assert r["risk_level"] == "CRITICAL"


def test_unrealistic_capacity_factor_flagged():
    # 5 MW solar, 31 days → max 3.72 GWh; claiming 1.6 GWh = 43% CF, above the ~32% solar reality
    r = score_claim(
        claimed_kwh=1_600_000,
        expected_kwh=1_550_000,
        actual_kwh=None,
        capacity_mw=5,
        period_days=31,
        certificate_status="VALID",
    )
    assert any("capacity factor" in f["text"].lower() for f in r["findings"])


def test_without_ai_or_actual_only_cert_and_capacity_count():
    r = score_claim(
        claimed_kwh=600_000,
        expected_kwh=None,
        actual_kwh=None,
        capacity_mw=5,
        period_days=31,
        certificate_status="VALID",
    )
    assert r["total_score"] == 0 and r["risk_level"] == "LOW"


def test_thresholds_and_weights_configurable(monkeypatch):
    monkeypatch.setenv("RISK_THRESHOLDS", "10,20,30")
    assert level_for(25) == "HIGH" and level_for(31) == "CRITICAL" and level_for(10) == "LOW"
    monkeypatch.setenv("RISK_WEIGHTS", "60,10,10,10,10")
    r = score_claim(
        claimed_kwh=890_000,
        expected_kwh=620_000,
        actual_kwh=None,
        capacity_mw=5,
        period_days=31,
        certificate_status="VALID",
    )
    assert r["components"]["generation"] == 60 and r["weights"]["generation"] == 60
    monkeypatch.setenv("RISK_THRESHOLDS", "bad")
    assert level_for(50) == "MEDIUM"  # falls back to defaults


def test_medium_band():
    r = score_claim(
        claimed_kwh=740_000,
        expected_kwh=620_000,
        actual_kwh=605_000,
        capacity_mw=5,
        period_days=31,
        historical_expected_kwh=630_000,
        certificate_status="VALID",
    )
    assert r["risk_level"] in ("MEDIUM", "HIGH")
    assert 30 < r["total_score"] <= 80
