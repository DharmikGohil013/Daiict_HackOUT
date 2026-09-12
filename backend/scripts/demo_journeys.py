"""
Run the four GreenShield demo journeys (FinalMD.md §49–52) against a live API.

    cd backend && python scripts/demo_journeys.py [--base http://localhost:5001]

Journeys
  1. Government   login → dashboard → CRITICAL claim → claim detail (comparison, AI explanation,
                  certificate checks) → investigation → evidence (read-only on the seeded hero claim)
  2. Certificate  verifier: tampered file → TAMPERED; re-labelled file → ID tampering; freshly
                  issued REC → VALID
  3. Duplicate    fresh REC claimed by institution A (verified, certificate marked claimed), then
                  by institution B → DUPLICATE CLAIM BLOCKED
  4. Generation   generator submits meter data → forecast → institution claims 1.6× actual →
                  flagged CRITICAL → government rejects → audit trail updated

Exit code 0 when every check passes. The script creates fresh certificates/claims (ids carry a
timestamp) and only mutates those, so the seeded demo data stays intact.
"""

import argparse
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
STORAGE = os.path.join(BACKEND, "storage", "certificates")

PASS, FAIL = "\033[32mPASS\033[0m", "\033[31mFAIL\033[0m"
results = []


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(f"  [{PASS if ok else FAIL}] {name}{(' — ' + str(detail)) if detail else ''}")
    return ok


class Api:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.token = None

    def _req(self, method, path, data=None, files=None, form=None):
        url = f"{self.base}/api{path}"
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        body = None
        if files or form:
            boundary = f"----greenshield{uuid.uuid4().hex}"
            parts = []
            for k, v in (form or {}).items():
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
            for k, (fname, blob) in (files or {}).items():
                ctype = mimetypes.guess_type(fname)[0] or "application/octet-stream"
                parts.append(
                    f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{fname}"\r\nContent-Type: {ctype}\r\n\r\n'.encode()  # noqa: E501
                    + blob
                    + b"\r\n"
                )
            parts.append(f"--{boundary}--\r\n".encode())
            body = b"".join(parts)
            headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        elif data is not None:
            body = json.dumps(data).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=body, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.status, json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read() or b"{}")
            except json.JSONDecodeError:
                return e.code, {}

    def get(self, path):
        return self._req("GET", path)

    def post(self, path, data=None, **kw):
        return self._req("POST", path, data, **kw)

    def put(self, path, data=None):
        return self._req("PUT", path, data)

    def download(self, path):
        req = urllib.request.Request(
            f"{self.base}{path}", headers={"Authorization": f"Bearer {self.token}"} if self.token else {}
        )
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()

    def login(self, role):
        status, body = self.post(f"/auth/demo/{role}")
        if status != 200:
            raise SystemExit(f"demo login for {role} failed: {status} {body}")
        self.token = body["access_token"]
        return body["user"]


def month_bounds(year, month):
    start = date(year, month, 1)
    nxt = date(year + (month == 12), (month % 12) + 1, 1)
    return start.isoformat(), (nxt - timedelta(days=1)).isoformat()


def journey_government(api):
    print("\nJourney 1 — Primary government demo (§49)")
    user = api.login("government")
    check("Government login", user["role"] == "government", user["email"])
    s, d = api.get("/dashboard/government")
    check(
        "Dashboard loads with KPIs",
        s == 200 and d["kpis"]["registered_plants"] > 0,
        f"{d['kpis']['registered_plants']} plants, {d['kpis']['critical_risk']} critical",
    )
    check(
        "Dashboard shows AI alerts", len(d.get("alerts", [])) > 0, d["alerts"][0]["text"] if d.get("alerts") else "none"
    )
    s, c = api.get("/claims?risk_level=CRITICAL&order=risk_score%20DESC")
    check("CRITICAL claims listed", s == 200 and c["total"] > 0, f"{c['total']} claims")
    hero = next((x for x in c["claims"] if x["claim_id"] == "CLM-0001"), c["claims"][0])
    s, det = api.get(f"/claims/{hero['claim_id']}")
    claim = det["claim"]
    check(
        "Claim detail: claimed vs AI expected vs actual",
        claim["expected_kwh"] and claim["actual_kwh"],
        f"claimed {claim['claimed_kwh']/1000:,.0f} / expected {claim['expected_kwh']/1000:,.0f} / actual {claim['actual_kwh']/1000:,.0f} MWh",  # noqa: E501
    )
    fs = claim.get("fraud_score") or {}
    check(
        "AI explanation with findings and risk contribution",
        bool(fs.get("findings")) and sum(fs.get("components", {}).values()) > 0,
        f"{claim['risk_score']}/100 {claim['risk_level']}",
    )
    sec = claim.get("certificate_security") or {}
    check("Certificate security checks present", sec.get("last_result") is not None, sec.get("last_result"))
    check("Investigation linked", bool(claim.get("case_id")), claim.get("case_id"))
    if claim.get("case_id"):
        s, inv = api.get(f"/investigations/{claim['case_id']}")
        ev = inv["case"]["evidence"]
        check(
            "Investigation evidence bundle (AI, certificate, generation, weather, ledger, audit)",
            s == 200
            and ev["ai"]
            and len(ev["generation"]) > 0
            and len(ev["weather"]) > 0
            and len(inv["case"]["audit"]) > 0,
            f"{len(ev['generation'])} generation days, {len(inv['case']['audit'])} audit events",
        )
    return hero


def journey_certificate(api):
    print("\nJourney 2 — Certificate fraud (§50)")
    api.login("government")
    for fname, expect_final, expect_status in (
        ("REC-002_TAMPERED.png", "TAMPERED", "TAMPERED"),
        ("REC-999_IDTAMPERED.png", "TAMPERED", "ID_TAMPERED"),
    ):
        path = os.path.join(STORAGE, fname)
        if not os.path.exists(path):
            check(f"{fname} exists (run seed_greenshield.py)", False)
            continue
        with open(path, "rb") as f:
            s, v = api.post("/rec/verify", files={"file": (fname, f.read())})
        steps = {x["step"]: x["status"] for x in v.get("steps", [])}
        check(
            f"{fname} → {expect_final} ({expect_status})",
            s == 200 and v["final_result"] == expect_final and v["certificate_status"] == expect_status,
            f"hash {v.get('summary', {}).get('hash')} · rsa {v.get('summary', {}).get('rsa')} · steps {steps}",
        )
        if expect_status == "ID_TAMPERED":
            check(
                "Original certificate identified from the signed payload",
                (v.get("original_record") or {}).get("cert_id") == "REC-004",
                (v.get("original_record") or {}).get("cert_id"),
            )
    # fresh valid certificate
    api.login("issuer")
    cid = f"REC-DEMO-{int(time.time()) % 100000}"
    s, issued = api.post(
        "/rec/issue",
        {
            "certificate_id": cid,
            "generator_id": "GEN-001",
            "energy_kwh": 12000,
            "generation_date": "2026-09-05",
            "energy_type": "Solar",
        },
    )
    check(
        "Issuer pipeline: hash → sign → embed → ledger",
        s == 201 and len(issued.get("steps", [])) == 6 and issued["ledger"] == "REGISTERED",
        issued.get("cert_id"),
    )
    blob = api.download(issued["download_url"])
    s, v = api.post("/rec/verify", files={"file": (issued["file_name"], blob)})
    check(
        "Freshly issued REC verifies VALID",
        s == 200 and v["final_result"] == "VALID",
        f"generation {v['summary']['generation']}",
    )
    return cid


def journey_duplicate(api):
    print("\nJourney 3 — Duplicate claim prevention (§51)")
    api.login("issuer")
    start, end = month_bounds(2026, 7)
    s, gen = api.get(f"/generation/GEN-009?start={start}&end={end}")
    actual = float(gen["stats"]["total_kwh"])
    cid = f"REC-DUP-{int(time.time()) % 100000}"
    s, issued = api.post(
        "/rec/issue",
        {
            "certificate_id": cid,
            "generator_id": "GEN-009",
            "energy_kwh": round(actual, 1),
            "generation_date": end,
            "energy_type": "Solar",
        },
    )
    check("Issue certificate for July generation", s == 201, cid)
    blob = api.download(issued["download_url"])
    api.login("institution")  # INST-045
    s, r = api.post(
        "/claims",
        form={
            "plant_id": "GEN-009",
            "cert_id": cid,
            "period_start": start,
            "period_end": end,
            "claimed_kwh": round(actual, 1),
        },
        files={"file": (issued["file_name"], blob)},
    )
    a = r.get("claim", {})
    check(
        "Institution A claim → verified, certificate marked claimed",
        s == 201 and a.get("status") == "verified" and a.get("ledger_record", {}).get("status") == "claimed",
        f"{a.get('claim_id')} risk {a.get('risk_score')} cert {a.get('certificate_status')}",
    )
    api.login("government")
    s, r = api.post(
        "/claims",
        form={
            "plant_id": "GEN-009",
            "cert_id": cid,
            "institution_id": "INST-042",
            "period_start": start,
            "period_end": end,
            "claimed_kwh": round(actual, 1),
        },
        files={"file": (issued["file_name"], blob)},
    )
    b = r.get("claim", {})
    check(
        "Institution B same certificate → DUPLICATE CLAIM BLOCKED",
        s == 201
        and b.get("status") == "rejected"
        and b.get("certificate_status") == "DUPLICATE"
        and b.get("decision") == "duplicate_blocked",
        f"{b.get('claim_id')} {b.get('decision_note')}",
    )
    s, cert = api.get(f"/certificates/{cid}")
    check(
        "Certificate page shows CLAIMED by A with 2 claims",
        cert["ledger_record"]["claimed_by"] == "INST-045" and len(cert["claims"]) == 2,
        cert["final_status"],
    )
    return cid


def journey_generation(api):
    print("\nJourney 4 — Generation fraud (§52)")
    api.login("generator")  # GEN-001
    today = date(2026, 9, 12)
    s, r = api.post(
        "/generation",
        {
            "plant_id": "GEN-001",
            "rows": [
                {
                    "date": today.isoformat(),
                    "generation_kwh": 17800,
                    "meter_reading_kwh": 1290100,
                    "operating_hours": 11.5,
                }
            ],
        },
    )
    check("Generator submits meter data", s == 201 and r["rows"] == 1, r.get("last_date"))
    s, f = api.get("/prediction/forecast/GEN-001")
    check(
        "AI forecast 24/48/72 h",
        s == 200 and [x["horizon_hours"] for x in f["forecast"]] == [24, 48, 72],
        f"{f['forecast'][0]['predicted_kwh']/1000:.1f} MWh next 24 h",
    )
    start, end = month_bounds(2026, 8)
    s, gen = api.get(f"/generation/GEN-001?start={start}&end={end}")
    actual = float(gen["stats"]["total_kwh"])
    api.login("issuer")
    cid = f"REC-GEN-{int(time.time()) % 100000}"
    s, issued = api.post(
        "/rec/issue",
        {
            "certificate_id": cid,
            "generator_id": "GEN-001",
            "energy_kwh": round(actual, 1),
            "generation_date": end,
            "energy_type": "Solar",
        },
    )
    blob = api.download(issued["download_url"])
    api.login("institution")
    claimed = round(actual * 1.6, 1)
    s, r = api.post(
        "/claims",
        form={"plant_id": "GEN-001", "cert_id": cid, "period_start": start, "period_end": end, "claimed_kwh": claimed},
        files={"file": (issued["file_name"], blob)},
    )
    c = r.get("claim", {})
    check(
        "Inflated claim (1.6× actual) → flagged HIGH/CRITICAL with investigation",
        s == 201 and c.get("status") == "flagged" and c.get("risk_level") in ("HIGH", "CRITICAL") and c.get("case_id"),
        f"{c.get('claim_id')} claimed {claimed/1000:,.0f} vs expected {c.get('expected_kwh', 0)/1000:,.0f} MWh → {c.get('risk_score')} {c.get('risk_level')}",  # noqa: E501
    )
    check(
        "Certificate itself is authentic (fraud is generation-side)",
        c.get("certificate_status") == "VALID",
        c.get("certificate_status"),
    )
    api.login("government")
    s, d = api.get("/dashboard/government")
    check(
        "Government dashboard alert for the new claim",
        any(a["claim_id"] == c["claim_id"] for a in d.get("alerts", []))
        or any(x["claim_id"] == c["claim_id"] for x in d["recent_high_risk"]),
    )
    s, dec = api.post(
        f"/investigations/{c['case_id']}/decision",
        {"decision": "reject", "note": "Meter data and AI expectation contradict the claimed generation."},
    )
    check(
        "Government rejects via investigation",
        s == 200 and dec["claim"]["status"] == "rejected" and dec["case"]["status"] == "resolved_rejected",
    )
    s, audit = api.get(f"/audit/{c['claim_id']}")
    actions = [e["action"] for e in audit.get("events", [])]
    check(
        "Audit trail updated with the full chain",
        "Claim submitted" in actions
        and "Fraud score calculated" in actions
        and "Investigation opened" in actions
        and actions[-1] == "Claim rejected",
        f"{len(actions)} events",
    )
    s, chain = api.get("/audit/verify")
    check("Audit hash chain intact", chain.get("valid") is True, f"{chain.get('entries')} entries")
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.getenv("GREENSHIELD_API", "http://localhost:5001"))
    args = ap.parse_args()
    api = Api(args.base)
    s, h = api.get("/health")
    if s != 200:
        raise SystemExit(f"API not reachable at {args.base}: {s}")
    print(f"GreenShield demo journeys against {args.base} ({h.get('service')} {h.get('version')})")
    journey_government(api)
    journey_certificate(api)
    journey_duplicate(api)
    journey_generation(api)
    passed, total = sum(results), len(results)
    print(f"\n{passed}/{total} checks passed")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
