"""Hash-chained audit trail."""

from modules import audit
from modules.ledger import get_db


def test_chain_links_and_verifies():
    a = audit.record("Claim submitted", "inst", claim_id="CLM-1", cert_id="REC-1", transaction_id="TXN-1", detail="x")
    b = audit.record("Hash verified", "system", claim_id="CLM-1", cert_id="REC-1", reference_hash="ab" * 32)
    assert a["prev_hash"] == audit.GENESIS
    assert b["prev_hash"] == a["entry_hash"]
    assert len(b["entry_hash"]) == 64
    assert audit.verify_chain() == {"valid": True, "entries": 2, "head": b["entry_hash"]}


def test_tampering_with_history_is_detected():
    audit.record("Claim submitted", "inst", claim_id="CLM-1")
    audit.record("Claim rejected", "gov", claim_id="CLM-1", detail="fraud")
    audit.record("Audit exported", "gov")
    with get_db() as conn:
        conn.execute("UPDATE audit_logs SET detail = 'approved' WHERE action = 'Claim rejected'")
    result = audit.verify_chain()
    assert result["valid"] is False and result["broken_at_id"] == 2


def test_deleting_a_row_breaks_the_chain():
    audit.record("A", "x")
    audit.record("B", "x")
    audit.record("C", "x")
    with get_db() as conn:
        conn.execute("DELETE FROM audit_logs WHERE action = 'B'")
    assert audit.verify_chain()["valid"] is False


def test_timeline_filters_and_order():
    audit.record("one", "x", claim_id="CLM-1", transaction_id="TXN-1")
    audit.record("two", "x", claim_id="CLM-2", cert_id="REC-9")
    audit.record("three", "x", claim_id="CLM-1", transaction_id="TXN-1")
    assert [e["action"] for e in audit.timeline(claim_id="CLM-1")] == ["one", "three"]
    assert [e["action"] for e in audit.timeline(transaction_id="TXN-1", newest_first=True)] == ["three", "one"]
    assert [e["action"] for e in audit.timeline(cert_id="REC-9")] == ["two"]
    assert audit.recent(limit=2)[0]["action"] == "three"
    assert audit.count() == 3
