"""Claims pipeline: crypto + AI + risk engines, atomic duplicate prevention, government decisions."""

import threading
from datetime import date, timedelta

import pytest

from modules import audit, ledger, registry
from modules.claims import (
    claim_stats,
    claims_for_certificate,
    decide_claim,
    evaluate_certificate,
    get_claim,
    list_claims,
    submit_claim,
)
from modules.investigations import case_stats, get_case, list_cases
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


@pytest.fixture
def world():
    registry.upsert_plant(PLANT)
    registry.upsert_institution({"institution_id": "INST-045", "name": "Acme Steel"})
    registry.upsert_institution({"institution_id": "INST-042", "name": "GreenTech"})
    # 60 days of metered generation from the physics model
    for back in range(75, 11, -1):
        d = date(2026, 9, 12) - timedelta(days=back)
        w = seasonal_weather(PLANT["latitude"], PLANT["longitude"], d)
        registry.upsert_weather("GEN-001", d.isoformat(), w)
        registry.upsert_generation("GEN-001", d.isoformat(), physical_generation_kwh("Solar", 5, w), source="seed")
    actual = registry.sum_generation("GEN-001", *AUG)
    return {"actual": actual}


def _issue(cert_id, kwh):
    r = issue_certificate(
        cert_id=cert_id,
        generator_id="GEN-001",
        source_type="Solar",
        energy_kwh=kwh,
        generation_date="2026-08-31",
        issuer_id="ISSUER-NREC-01",
    )
    assert r["success"], r
    return r["file_path"]


def _tamper(src, dst, **changes):
    p = extract_payload_from_file(src)
    p.update(changes)
    return embed_payload_in_png(src, p, dst)


def test_honest_claim_is_auto_verified_and_claims_certificate(world):
    path = _issue("REC-001", world["actual"])
    r = submit_claim(
        "INST-045",
        "GEN-001",
        "REC-001",
        *AUG,
        claimed_kwh=world["actual"] * 0.99,
        transaction_id="TXN-1",
        certificate_file_path=path,
        submitted_by="claims@inst-045.org",
    )
    assert r["status"] == "verified" and r["decision"] == "auto_verified"
    assert r["certificate_status"] == "VALID" and r["fraud_type"] == "none"
    assert r["risk_level"] == "LOW"
    assert r["expected_kwh"] > 0 and r["actual_kwh"] == pytest.approx(world["actual"])
    assert ledger.lookup_certificate("REC-001")["status"] == "claimed"
    assert ledger.lookup_certificate("REC-001")["claimed_by"] == "INST-045"
    assert r["certificate_security"]["hash_verified"] == 1 and r["certificate_security"]["last_result"] == "VALID"
    actions = [e["action"] for e in audit.timeline(claim_id=r["claim_id"])]
    assert (
        actions[0] == "Claim submitted"
        and "AI prediction generated" in actions
        and "Certificate marked claimed" in actions
    )
    assert audit.verify_chain()["valid"]


def test_case_a_inflated_claim_is_flagged_critical_with_investigation(world):
    path = _issue("REC-1022", world["actual"])
    r = submit_claim("INST-045", "GEN-001", "REC-1022", *AUG, claimed_kwh=890_000, certificate_file_path=path)
    assert r["status"] == "flagged" and r["risk_level"] == "CRITICAL"
    assert r["certificate_status"] == "VALID" and r["fraud_type"] == "inflated_generation"
    assert r["deviation_pct"] > 30
    assert r["investigation"]["status"] == "open" and r["case_id"] == r["investigation"]["case_id"]
    assert ledger.lookup_certificate("REC-1022")["status"] == "issued"  # not claimed until government approves
    assert r["fraud_score"]["components"]["generation"] == 40
    assert any("above AI expected" in f["text"] for f in r["fraud_score"]["findings"])
    assert "Investigation opened" in [e["action"] for e in audit.timeline(claim_id=r["claim_id"])]


def test_case_b_tampered_certificate(world, tmp_path):
    path = _issue("REC-002", 100.0)
    bad = _tamper(path, str(tmp_path / "REC-002_TAMPERED.png"), energy_kwh=1000.0)
    r = submit_claim(
        "INST-045", "GEN-001", "REC-002", "2026-08-10", "2026-08-10", claimed_kwh=1000.0, certificate_file_path=bad
    )
    assert r["certificate_status"] == "TAMPERED" and r["fraud_type"] == "tampered_certificate"
    assert r["status"] == "flagged" and r["risk_level"] == "CRITICAL"
    sec = r["certificate_security"]
    assert sec["steg_verified"] == 1 and sec["hash_verified"] == 0 and sec["ledger_verified"] == 0
    assert r["fraud_score"]["components"]["certificate"] == 10
    assert "SHA-256 hash MISMATCH" in [e["action"] for e in audit.timeline(claim_id=r["claim_id"])]


def test_case_c_duplicate_claim_blocked(world):
    path = _issue("REC-003", world["actual"])
    first = submit_claim(
        "INST-045", "GEN-001", "REC-003", *AUG, claimed_kwh=world["actual"], certificate_file_path=path
    )
    assert first["status"] == "verified"
    second = submit_claim(
        "INST-042", "GEN-001", "REC-003", *AUG, claimed_kwh=world["actual"], certificate_file_path=path
    )
    assert second["status"] == "rejected" and second["decision"] == "duplicate_blocked"
    assert second["certificate_status"] == "DUPLICATE" and second["fraud_type"] == "duplicate_claim"
    assert second["risk_level"] == "CRITICAL"
    assert "INST-045" in second["decision_note"]
    assert ledger.lookup_certificate("REC-003")["claimed_by"] == "INST-045"
    assert "Duplicate claim blocked" in [e["action"] for e in audit.timeline(claim_id=second["claim_id"])]
    assert len(claims_for_certificate("REC-003")) == 2


def test_case_d_certificate_id_tampering(world, tmp_path):
    path = _issue("REC-004", world["actual"])
    relabelled = _tamper(path, str(tmp_path / "REC-999.png"), cert_id="REC-999")
    r = submit_claim(
        "INST-045", "GEN-001", "REC-999", *AUG, claimed_kwh=world["actual"], certificate_file_path=relabelled
    )
    assert r["certificate_status"] == "ID_TAMPERED" and r["fraud_type"] == "certificate_id_tampering"
    assert r["status"] == "flagged"
    assert r["certificate_engine"]["original_record"]["cert_id"] == "REC-004"
    assert "REC-004" in r["certificate_engine"]["reason"]


def test_submitted_id_differs_from_embedded_id(world):
    path = _issue("REC-005", world["actual"])
    r = submit_claim("INST-045", "GEN-001", "REC-555", *AUG, claimed_kwh=world["actual"], certificate_file_path=path)
    assert r["certificate_status"] == "ID_TAMPERED"


def test_unregistered_certificate_without_file(world):
    r = submit_claim("INST-045", "GEN-001", "REC-7777", *AUG, claimed_kwh=world["actual"])
    assert (
        r["certificate_status"] == "NOT_FOUND"
        and r["fraud_type"] == "unregistered_certificate"
        and r["status"] == "flagged"
    )


def test_registered_certificate_without_file_is_low_confidence_valid(world):
    _issue("REC-006", world["actual"])
    r = submit_claim("INST-045", "GEN-001", "REC-006", *AUG, claimed_kwh=world["actual"])
    assert r["certificate_status"] == "NOT_PROVIDED" and r["status"] == "verified"
    assert r["fraud_score"]["components"]["certificate"] == 3


def test_government_decisions(world):
    path = _issue("REC-010", world["actual"])
    r = submit_claim("INST-045", "GEN-001", "REC-010", *AUG, claimed_kwh=890_000, certificate_file_path=path)
    cid = r["claim_id"]
    ev = decide_claim(cid, "request_evidence", "gov@greenshield.gov", "Send meter logs")
    assert ev["status"] == "evidence_requested" and ev["investigation_status"] == "awaiting_evidence"
    rej = decide_claim(cid, "reject", "gov@greenshield.gov", "Inflated")
    assert (
        rej["status"] == "rejected"
        and rej["decided_by"] == "gov@greenshield.gov"
        and rej["investigation_status"] == "resolved_rejected"
    )
    with pytest.raises(ValueError):
        decide_claim(cid, "approve", "gov@greenshield.gov")
    actions = [e["action"] for e in audit.timeline(claim_id=cid)]
    assert actions[-1] == "Claim rejected" and "Government review started" in actions

    path2 = _issue("REC-011", world["actual"])
    r2 = submit_claim(
        "INST-045", "GEN-001", "REC-011", *AUG, claimed_kwh=world["actual"] * 1.5, certificate_file_path=path2
    )
    assert r2["status"] == "flagged"
    ok = decide_claim(r2["claim_id"], "approve", "gov@greenshield.gov", "Meter logs confirm")
    assert ok["status"] == "approved" and ledger.lookup_certificate("REC-011")["status"] == "claimed"
    assert case_stats()["resolved_approved"] == 1 and case_stats()["resolved_rejected"] == 1


def test_approving_after_certificate_claimed_elsewhere_rejects(world):
    path = _issue("REC-012", world["actual"])
    flagged = submit_claim(
        "INST-045", "GEN-001", "REC-012", *AUG, claimed_kwh=world["actual"] * 1.6, certificate_file_path=path
    )
    assert flagged["status"] == "flagged"
    assert ledger.mark_claimed("REC-012", "INST-042")  # someone else claims it first
    r = decide_claim(flagged["claim_id"], "approve", "gov@greenshield.gov")
    assert r["status"] == "rejected" and "duplicate" in r["decision_note"].lower()


def test_cannot_approve_tampered(world, tmp_path):
    path = _issue("REC-013", 100.0)
    bad = _tamper(path, str(tmp_path / "bad.png"), energy_kwh=999.0)
    r = submit_claim(
        "INST-045", "GEN-001", "REC-013", "2026-08-10", "2026-08-10", claimed_kwh=999.0, certificate_file_path=bad
    )
    with pytest.raises(ValueError, match="TAMPERED"):
        decide_claim(r["claim_id"], "approve", "gov")


def test_atomic_claim_under_concurrency(world):
    _issue("REC-020", world["actual"])
    results = []

    def worker(inst):
        results.append(ledger.mark_claimed("REC-020", inst))

    threads = [threading.Thread(target=worker, args=(f"INST-{i:03d}",)) for i in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert results.count(True) == 1 and results.count(False) == 7


def test_validation_errors(world):
    with pytest.raises(ValueError):
        submit_claim("INST-045", "NOPE", "REC-1", *AUG, claimed_kwh=10)
    with pytest.raises(ValueError):
        submit_claim("NOPE", "GEN-001", "REC-1", *AUG, claimed_kwh=10)
    with pytest.raises(ValueError):
        submit_claim("INST-045", "GEN-001", "REC-1", *AUG, claimed_kwh=0)
    with pytest.raises(ValueError):
        submit_claim("INST-045", "GEN-001", "REC-1", "2026-08-31", "2026-08-01", claimed_kwh=10)


def test_queries_and_stats(world, tmp_path):
    p1 = _issue("REC-030", world["actual"])
    submit_claim("INST-045", "GEN-001", "REC-030", *AUG, claimed_kwh=world["actual"], certificate_file_path=p1)
    p2 = _issue("REC-031", world["actual"])
    flagged = submit_claim("INST-042", "GEN-001", "REC-031", *AUG, claimed_kwh=900_000, certificate_file_path=p2)
    listing = list_claims(limit=10)
    assert listing["total"] == 2 and listing["claims"][0]["plant_name"] == "Kutch Solar Park A"
    assert list_claims(status="flagged")["total"] == 1
    assert list_claims(risk_level="CRITICAL")["claims"][0]["claim_id"] == flagged["claim_id"]
    assert list_claims(search="greentech")["total"] == 1
    assert list_claims(min_risk=50)["total"] == 1
    assert list_claims(order="risk_score DESC")["claims"][0]["claim_id"] == flagged["claim_id"]
    stats = claim_stats()
    assert stats["total_claims"] == 2 and stats["critical_claims"] == 1 and stats["verified_claims"] == 1
    assert stats["verified_energy_kwh"] == pytest.approx(world["actual"])
    assert get_claim("NOPE") is None

    case = list_cases()[0]
    detail = get_case(case["case_id"])
    assert detail["claim"]["claim_id"] == flagged["claim_id"]
    assert len(detail["evidence"]["generation"]) > 30 and len(detail["evidence"]["predictions"]) >= 31
    assert detail["evidence"]["steg_payload"]["cert_id"] == "REC-031"
    assert detail["related_claims"]["same_plant"][0]["claim_id"] != flagged["claim_id"]
    assert detail["audit"][0]["action"] == "Claim submitted"
    assert get_case("NOPE") is None


def test_evaluate_certificate_standalone(world, tmp_path):
    path = _issue("REC-040", world["actual"])
    ok = evaluate_certificate("REC-040", path, "auditor")
    assert ok["status"] == "VALID" and ok["checks"] == {
        "steganography": True,
        "hash": True,
        "signature": True,
        "ledger": True,
        "claim_state": True,
    }
    ledger.revoke_certificate("REC-040", "gov")
    assert evaluate_certificate("REC-040", path, "auditor")["status"] == "REVOKED"
    assert evaluate_certificate("REC-040", None, "auditor")["status"] == "REVOKED"
    plain = tmp_path / "plain.png"
    from PIL import Image

    Image.new("RGB", (400, 300), (255, 255, 255)).save(plain)
    assert evaluate_certificate("REC-040", str(plain), "auditor")["status"] == "TAMPERED"
