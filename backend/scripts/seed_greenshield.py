"""
Seed the GreenShield demo dataset.

    cd backend && python scripts/seed_greenshield.py [--reset]

Creates 12 plants, 12 institutions, 90 days of weather + metered generation per plant,
real REC certificates (issued through the REC Guard pipeline, files on disk), REC purchase
transactions, 30+ claims run through the full verification pipeline (so predictions,
fraud scores, investigations and the audit trail are all genuine), and demo users.

Demo cases (FinalMD.md §39):
  A  CLAIM on REC-1022 — GEN-001 claims 890 MWh vs ~620 expected / ~605 actual  → CRITICAL
  B  REC-002 tampered 100 kWh → 1000 kWh                                          → TAMPERED
  C  REC-003 claimed twice                                                         → DUPLICATE BLOCKED
  D  REC-004 re-labelled as REC-999                                                → ID TAMPERING
"""

import os
import random
import sys
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)

import numpy as np  # noqa: E402
from werkzeug.security import generate_password_hash  # noqa: E402

from config import cert_storage_path  # noqa: E402
from modules import audit, ledger, registry  # noqa: E402
from modules.claims import decide_claim, submit_claim  # noqa: E402
from modules.crypto import generate_key_pair  # noqa: E402
from modules.issuer import issue_certificate  # noqa: E402
from modules.ml.synthetic import physical_generation_kwh, seasonal_weather  # noqa: E402
from modules.steg import embed_payload_in_png, extract_payload_from_file  # noqa: E402

TODAY = date(2026, 9, 12)
HISTORY_DAYS = 90
DEMO_PASSWORD = "Demo@1234"

PLANTS = [
    ("GEN-001", "Kutch Solar Park A", "Solar", 5, "Bhuj, Gujarat", "Gujarat", 23.24, 69.67, "ops@gen-001.in"),
    ("GEN-002", "Jaisalmer Wind Farm", "Wind", 25, "Jaisalmer, Rajasthan", "Rajasthan", 26.92, 70.91, "ops@gen-002.in"),
    (
        "GEN-003",
        "Tirunelveli Wind Cluster",
        "Wind",
        50,
        "Tirunelveli, Tamil Nadu",
        "Tamil Nadu",
        8.73,
        77.70,
        "ops@gen-003.in",
    ),
    ("GEN-004", "Bhadla Solar Block B", "Solar", 100, "Bhadla, Rajasthan", "Rajasthan", 27.53, 71.91, "ops@gen-004.in"),
    (
        "GEN-005",
        "Pavagada Solar Unit 3",
        "Solar",
        50,
        "Pavagada, Karnataka",
        "Karnataka",
        14.10,
        77.28,
        "ops@gen-005.in",
    ),
    ("GEN-006", "Satara Ridge Wind", "Wind", 10, "Satara, Maharashtra", "Maharashtra", 17.68, 73.99, "ops@gen-006.in"),
    ("GEN-007", "Tehri Hydro Unit 2", "Hydro", 25, "Tehri, Uttarakhand", "Uttarakhand", 30.38, 78.48, "ops@gen-007.in"),
    (
        "GEN-008",
        "Kinnaur Small Hydro",
        "Hydro",
        5,
        "Kinnaur, Himachal Pradesh",
        "Himachal Pradesh",
        31.58,
        78.26,
        "ops@gen-008.in",
    ),
    (
        "GEN-009",
        "Anantapur Solar",
        "Solar",
        10,
        "Anantapur, Andhra Pradesh",
        "Andhra Pradesh",
        14.68,
        77.60,
        "ops@gen-009.in",
    ),
    (
        "GEN-010",
        "Muppandal Wind Park",
        "Wind",
        100,
        "Kanyakumari, Tamil Nadu",
        "Tamil Nadu",
        8.25,
        77.55,
        "ops@gen-010.in",
    ),
    (
        "GEN-011",
        "Rewa Ultra Mega Solar",
        "Solar",
        50,
        "Rewa, Madhya Pradesh",
        "Madhya Pradesh",
        24.53,
        81.30,
        "ops@gen-011.in",
    ),
    ("GEN-012", "Mandvi Biomass Plant", "Biomass", 2, "Mandvi, Gujarat", "Gujarat", 22.83, 69.35, "ops@gen-012.in"),
]

INSTITUTIONS = [
    ("INST-045", "Acme Steel Ltd", "Manufacturing", "Ahmedabad, Gujarat", "claims@inst-045.org"),
    ("INST-012", "Nimbus Data Centres", "IT & Cloud", "Bengaluru, Karnataka", "esg@nimbusdc.in"),
    ("INST-018", "Sunrise Textiles", "Textiles", "Surat, Gujarat", "green@sunrisetex.in"),
    ("INST-023", "Meridian Cement", "Cement", "Jaipur, Rajasthan", "sustainability@meridiancement.in"),
    ("INST-031", "Coastal Logistics Co", "Logistics", "Chennai, Tamil Nadu", "carbon@coastallog.in"),
    ("INST-037", "Aurora Pharma", "Pharmaceuticals", "Hyderabad, Telangana", "rec@aurorapharma.in"),
    ("INST-042", "GreenTech Ltd", "Technology", "Pune, Maharashtra", "compliance@greentech.in"),
    ("INST-050", "Northwind Retail", "Retail", "Delhi", "energy@northwindretail.in"),
    ("INST-056", "Deccan Motors", "Automotive", "Chennai, Tamil Nadu", "esg@deccanmotors.in"),
    ("INST-061", "Vistara Foods", "FMCG", "Indore, Madhya Pradesh", "rec@vistarafoods.in"),
    ("INST-068", "Orion Chemicals", "Chemicals", "Vadodara, Gujarat", "green@orionchem.in"),
    ("INST-074", "Helix Biotech", "Biotech", "Hyderabad, Telangana", "sustainability@helixbio.in"),
]

USERS = [
    ("gov@greenshield.gov", "government", "Ministry of New & Renewable Energy", None, "Verification Officer"),
    ("ops@gen-001.in", "generator", "Kutch Solar Park A", "GEN-001", "Plant Operations, GEN-001"),
    ("claims@inst-045.org", "institution", "Acme Steel Ltd", "INST-045", "Sustainability Lead, Acme Steel"),
    ("issuer@greenshield.gov", "issuer", "National REC Registry", None, "REC Issuing Officer"),
    ("ops@gen-002.in", "generator", "Jaisalmer Wind Farm", "GEN-002", "Plant Operations, GEN-002"),
    ("esg@nimbusdc.in", "institution", "Nimbus Data Centres", "INST-012", "ESG Manager, Nimbus"),
]


def iso(d: date) -> str:
    return d.isoformat()


def month_bounds(year: int, month: int):
    start = date(year, month, 1)
    nxt = date(year + (month == 12), (month % 12) + 1, 1)
    return start, nxt - timedelta(days=1)


def seed_registry(rng):
    print("Plants & institutions")
    for pid, name, etype, cap, loc, state, lat, lon, email in PLANTS:
        registry.upsert_plant(
            {
                "plant_id": pid,
                "name": name,
                "energy_type": etype,
                "capacity_mw": cap,
                "location": loc,
                "state": state,
                "latitude": lat,
                "longitude": lon,
                "operator_email": email,
                "registered_at": datetime(2025, 1 + (int(pid[-2:]) % 12), 15, tzinfo=timezone.utc).isoformat(),
            }
        )
    for iid, name, sector, loc, email in INSTITUTIONS:
        registry.upsert_institution(
            {
                "institution_id": iid,
                "name": name,
                "sector": sector,
                "location": loc,
                "contact_email": email,
                "registered_at": datetime(2025, 3, 1, tzinfo=timezone.utc).isoformat(),
            }
        )
    print(f"  {len(PLANTS)} plants, {len(INSTITUTIONS)} institutions")


def seed_generation(rng):
    print(f"Weather + metered generation, {HISTORY_DAYS} days per plant")
    totals = {}
    for pid, name, etype, cap, loc, state, lat, lon, email in PLANTS:
        for back in range(HISTORY_DAYS, 0, -1):
            day = TODAY - timedelta(days=back)
            w = seasonal_weather(lat, lon, day, rng)
            registry.upsert_weather(pid, iso(day), w)
            gen = physical_generation_kwh(etype, cap, w, day, rng, noise=0.05)
            registry.upsert_generation(
                pid,
                iso(day),
                gen,
                meter_reading_kwh=round(gen * 1.0, 1),
                operating_hours=24.0 if etype != "Solar" else 11.5,
                source="seed",
                submitted_by=email,
                submitted_at=datetime.combine(day + timedelta(days=1), datetime.min.time(), timezone.utc).isoformat(),
            )
            totals.setdefault(pid, 0.0)
            totals[pid] += gen
    for pid, t in totals.items():
        print(f"  {pid}: {t / 1000:,.0f} MWh over {HISTORY_DAYS} days")
    return totals


def issue(cert_id, plant, start, end, kwh, issuer="ISSUER-NREC-01"):
    if ledger.lookup_certificate(cert_id):
        return ledger.lookup_certificate(cert_id)["cert_file_path"]
    r = issue_certificate(
        cert_id=cert_id,
        generator_id=plant["plant_id"],
        source_type=plant["energy_type"],
        energy_kwh=round(kwh, 1),
        generation_date=iso(end),
        issuer_id=issuer,
        output_format="png",
    )
    if not r["success"]:
        raise SystemExit(f"issuance failed for {cert_id}: {r['error']}")
    return r["file_path"]


def tamper(src, dst, **changes):
    payload = extract_payload_from_file(src)
    payload.update(changes)
    return embed_payload_in_png(src, payload, dst)


def seed_claims(rng):
    print("Certificates, transactions and claims (full pipeline)")
    plants = {p["plant_id"]: p for p in registry.list_plants()}
    inst_ids = [i[0] for i in INSTITUTIONS]
    storage = cert_storage_path()
    july = month_bounds(2026, 7)
    aug = month_bounds(2026, 8)
    txn_n = 0

    def txn(cert_id, pid, iid, kwh):
        nonlocal txn_n
        txn_n += 1
        tid = f"TXN-2026-{txn_n:04d}"
        registry.upsert_transaction(
            {
                "transaction_id": tid,
                "cert_id": cert_id,
                "seller_plant_id": pid,
                "buyer_institution_id": iid,
                "energy_kwh": round(kwh, 1),
                "price_inr": round(kwh * 2.35, 2),
            }
        )
        return tid

    def claim(cert_id, pid, iid, start, end, claimed, file_path=None, submitted_days_ago=None):
        ts = datetime.combine(
            TODAY - timedelta(days=submitted_days_ago if submitted_days_ago is not None else int(rng.integers(1, 20))),
            datetime.min.time(),
            timezone.utc,
        ) + timedelta(hours=int(rng.integers(8, 18)), minutes=int(rng.integers(0, 60)))
        r = submit_claim(
            iid,
            pid,
            cert_id,
            iso(start),
            iso(end),
            claimed,
            transaction_id=txn(cert_id, pid, iid, claimed),
            certificate_file_path=file_path,
            submitted_by=iid,
            submitted_at=ts.isoformat(),
        )
        print(
            f"  {r['claim_id']} {cert_id:9s} {pid} {iid} claimed {claimed / 1000:8.1f} MWh  expected {r['expected_kwh'] / 1000:7.1f}  "
            f"actual {(r['actual_kwh'] or 0) / 1000:7.1f}  risk {r['risk_score']:3d} {r['risk_level']:8s} cert {r['certificate_status']:11s} → {r['status']}"  # noqa: E501
        )
        return r

    # ── Case A (hero): GEN-001 August, claim 890 MWh ─────────
    p = plants["GEN-001"]
    actual_aug = registry.sum_generation("GEN-001", iso(aug[0]), iso(aug[1]))
    path_1022 = issue("REC-1022", p, *aug, actual_aug)
    hero = claim("REC-1022", "GEN-001", "INST-045", aug[0], aug[1], 890_000, file_path=path_1022, submitted_days_ago=1)

    # ── Case B: REC-002 tampered 100 → 1000 kWh ──────────────
    p = plants["GEN-012"]
    d = date(2026, 8, 10)
    path_002 = issue("REC-002", p, d, d, 100.0)
    tampered_002 = tamper(path_002, os.path.join(storage, "REC-002_TAMPERED.png"), energy_kwh=1000.0)
    claim("REC-002", "GEN-012", "INST-018", d, d, 1000.0, file_path=tampered_002, submitted_days_ago=2)

    # ── Case C: REC-003 claimed twice ────────────────────────
    p = plants["GEN-009"]
    actual_jul = registry.sum_generation("GEN-009", iso(july[0]), iso(july[1]))
    path_003 = issue("REC-003", p, *july, actual_jul)
    claim(
        "REC-003",
        "GEN-009",
        "INST-012",
        july[0],
        july[1],
        round(actual_jul * 1.01, 1),
        file_path=path_003,
        submitted_days_ago=9,
    )
    claim(
        "REC-003",
        "GEN-009",
        "INST-042",
        july[0],
        july[1],
        round(actual_jul * 1.0, 1),
        file_path=path_003,
        submitted_days_ago=3,
    )

    # ── Case D: REC-004 re-labelled as REC-999 ───────────────
    p = plants["GEN-006"]
    actual_jul_6 = registry.sum_generation("GEN-006", iso(july[0]), iso(july[1]))
    path_004 = issue("REC-004", p, *july, actual_jul_6)
    relabelled = tamper(path_004, os.path.join(storage, "REC-999_IDTAMPERED.png"), cert_id="REC-999")
    claim(
        "REC-999",
        "GEN-006",
        "INST-050",
        july[0],
        july[1],
        round(actual_jul_6, 1),
        file_path=relabelled,
        submitted_days_ago=4,
    )

    # ── Valid baseline: REC-001 ──────────────────────────────
    p = plants["GEN-001"]
    actual_jul_1 = registry.sum_generation("GEN-001", iso(july[0]), iso(july[1]))
    path_001 = issue("REC-001", p, *july, actual_jul_1)
    claim(
        "REC-001",
        "GEN-001",
        "INST-045",
        july[0],
        july[1],
        round(actual_jul_1 * 0.995, 1),
        file_path=path_001,
        submitted_days_ago=30,
    )

    # ── Unregistered certificate ─────────────────────────────
    claim("REC-7777", "GEN-005", "INST-061", *aug, 5_000_000.0, submitted_days_ago=5)

    # ── Bulk: one claim per plant for July and August with a risk mix ──
    profiles = [
        "normal",
        "normal",
        "normal",
        "medium",
        "normal",
        "high",
        "normal",
        "critical",
        "normal",
        "medium",
        "normal",
        "low_under",
    ]
    n = 2000  # bulk certificates are REC-2001…; keeps clear of the named demo certificates
    for idx, (pid, plant) in enumerate(sorted(plants.items())):
        for m_i, (start, end) in enumerate((july, aug)):
            actual = registry.sum_generation(pid, iso(start), iso(end))
            if not actual:
                continue
            n += 1
            cert_id = f"REC-{n}"
            path = issue(cert_id, plant, start, end, actual)
            profile = profiles[(idx + m_i * 5) % len(profiles)]
            factor = {
                "normal": rng.uniform(0.97, 1.03),
                "medium": rng.uniform(1.17, 1.24),
                "high": rng.uniform(1.32, 1.40),
                "critical": rng.uniform(1.55, 1.75),
                "low_under": rng.uniform(0.55, 0.65),
            }[profile]
            iid = inst_ids[(idx * 3 + m_i) % len(inst_ids)]
            claim(cert_id, pid, iid, start, end, round(actual * factor, 1), file_path=path)

    return hero


def seed_decisions(rng):
    print("Government decisions on a few flagged claims")
    from modules.investigations import list_cases

    cases = list_cases(status="open")
    decided = 0
    for case in cases:
        if case["fraud_type"] == "inflated_generation" and 60 < case["risk_score"] <= 80 and decided < 2:
            decide_claim(
                case["claim_id"],
                "request_evidence",
                "gov@greenshield.gov",
                "Please provide meter logs and O&M reports for the period.",
            )
            decided += 1
        elif case["fraud_type"] == "unregistered_certificate":
            decide_claim(
                case["claim_id"],
                "reject",
                "gov@greenshield.gov",
                "Certificate ID is not registered with the national REC registry.",
            )
    print(f"  {decided} evidence requests, unregistered-certificate claim rejected")


def seed_users():
    print("Demo users")
    for email, role, org, entity, display in USERS:
        if not ledger.get_user_by_email(email):
            ledger.create_user(
                email,
                generate_password_hash(DEMO_PASSWORD),
                role=role,
                organisation=org,
                entity_id=entity,
                display_name=display,
            )
        print(f"  {email:26s} {role:12s} {entity or ''}")
    print(f"  password for all demo users: {DEMO_PASSWORD}")


def main():
    if "--reset" in sys.argv:
        db_dir = os.path.dirname(ledger.get_db_path())
        for name in os.listdir(db_dir):
            if name.startswith("ledger.db"):
                os.remove(os.path.join(db_dir, name))
        print("Ledger reset.")
    generate_key_pair()
    ledger.init_db()
    rng = np.random.default_rng(2026)
    random.seed(2026)

    if registry.counts()["plants"] and ledger.count_certificates() > 20 and "--reset" not in sys.argv:
        print("GreenShield data already present — run with --reset to rebuild.")
        return

    seed_registry(rng)
    seed_generation(rng)
    hero = seed_claims(rng)
    seed_decisions(rng)
    seed_users()

    from modules.claims import claim_stats
    from modules.investigations import case_stats

    print("\nSummary")
    print("  registry:", registry.counts())
    print("  certificates:", ledger.count_certificates())
    print(
        "  claims:",
        {
            k: v
            for k, v in claim_stats().items()
            if k
            in (
                "total_claims",
                "verified_claims",
                "flagged_claims",
                "rejected_claims",
                "critical_claims",
                "duplicate_attempts",
                "tampering_attempts",
            )
        },
    )
    print("  investigations:", case_stats())
    print("  audit:", audit.verify_chain())
    print(
        f"  hero claim: {hero['claim_id']} risk {hero['risk_score']} {hero['risk_level']} — open /government/claims/{hero['claim_id']}"
    )


if __name__ == "__main__":
    main()
