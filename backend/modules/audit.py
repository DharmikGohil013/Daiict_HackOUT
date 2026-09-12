"""
Tamper-evident audit trail.

Every event is hash-chained: entry_hash = SHA-256(prev_hash ‖ timestamp ‖ actor ‖ action ‖
refs ‖ detail). Altering or deleting any historical row breaks every hash after it, which
verify_chain() detects.
"""

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from modules.ledger import get_db

GENESIS = "0" * 64


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash(
    prev: str,
    ts: str,
    actor: Optional[str],
    action: str,
    txn: Optional[str],
    claim: Optional[str],
    cert: Optional[str],
    ref: Optional[str],
    detail: Optional[str],
) -> str:
    payload = json.dumps(
        [prev, ts, actor or "", action, txn or "", claim or "", cert or "", ref or "", detail or ""],
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def record(
    action: str,
    actor: Optional[str] = None,
    claim_id: Optional[str] = None,
    cert_id: Optional[str] = None,
    transaction_id: Optional[str] = None,
    reference_hash: Optional[str] = None,
    detail: Optional[str] = None,
    timestamp: Optional[str] = None,
) -> Dict[str, Any]:
    """Append one event and return the stored row."""
    ts = timestamp or _now()
    with get_db() as conn:
        row = conn.execute("SELECT entry_hash FROM audit_logs ORDER BY id DESC LIMIT 1").fetchone()
        prev = row["entry_hash"] if row else GENESIS
        entry_hash = _hash(prev, ts, actor, action, transaction_id, claim_id, cert_id, reference_hash, detail)
        cur = conn.execute(
            """
            INSERT INTO audit_logs (timestamp, actor, action, transaction_id, claim_id, cert_id,
                                    reference_hash, detail, prev_hash, entry_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (ts, actor, action, transaction_id, claim_id, cert_id, reference_hash, detail, prev, entry_hash),
        )
        return dict(conn.execute("SELECT * FROM audit_logs WHERE id = ?", (cur.lastrowid,)).fetchone())


def timeline(
    claim_id: Optional[str] = None,
    transaction_id: Optional[str] = None,
    cert_id: Optional[str] = None,
    limit: int = 200,
    newest_first: bool = False,
) -> List[Dict[str, Any]]:
    query = "SELECT * FROM audit_logs WHERE 1=1"
    params: List[Any] = []
    if claim_id:
        query += " AND claim_id = ?"
        params.append(claim_id)
    if transaction_id:
        query += " AND transaction_id = ?"
        params.append(transaction_id)
    if cert_id:
        query += " AND cert_id = ?"
        params.append(cert_id)
    query += f" ORDER BY id {'DESC' if newest_first else 'ASC'} LIMIT ?"
    params.append(int(limit))
    with get_db() as conn:
        return [dict(r) for r in conn.execute(query, params).fetchall()]


def recent(limit: int = 50) -> List[Dict[str, Any]]:
    return timeline(limit=limit, newest_first=True)


def verify_chain() -> Dict[str, Any]:
    """Recompute every hash in order; report the first broken link if any."""
    with get_db() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM audit_logs ORDER BY id ASC").fetchall()]
    prev = GENESIS
    for r in rows:
        expected = _hash(
            prev,
            r["timestamp"],
            r["actor"],
            r["action"],
            r["transaction_id"],
            r["claim_id"],
            r["cert_id"],
            r["reference_hash"],
            r["detail"],
        )
        if r["prev_hash"] != prev or r["entry_hash"] != expected:
            return {"valid": False, "entries": len(rows), "broken_at_id": r["id"]}
        prev = r["entry_hash"]
    return {"valid": True, "entries": len(rows), "head": prev}


def count() -> int:
    with get_db() as conn:
        return conn.execute("SELECT COUNT(*) FROM audit_logs").fetchone()[0]
