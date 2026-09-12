"""
GreenShield schema — generation-side verification, claims, risk, investigations, audit.

These tables sit next to the REC Guard ledger tables (rec_ledger, verification_log,
anomaly_log, issuers, users) and are created by ledger.init_db().
"""

GREENSHIELD_SCHEMA_SQL = """
-- ============================================================
-- Renewable plants (generators)
-- ============================================================
CREATE TABLE IF NOT EXISTS plants (
    plant_id        TEXT PRIMARY KEY,            -- GEN-001
    name            TEXT NOT NULL,
    energy_type     TEXT NOT NULL,               -- Solar | Wind | Hydro | Biomass | Other
    capacity_mw     REAL NOT NULL,
    location        TEXT NOT NULL,               -- "Kutch, Gujarat"
    state           TEXT,
    latitude        REAL,
    longitude       REAL,
    operator_email  TEXT,
    registered_at   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK(status IN ('active', 'under_review', 'suspended'))
);

-- ============================================================
-- Institutions (claimants / REC buyers)
-- ============================================================
CREATE TABLE IF NOT EXISTS institutions (
    institution_id  TEXT PRIMARY KEY,            -- INST-045
    name            TEXT NOT NULL,
    sector          TEXT,
    location        TEXT,
    contact_email   TEXT,
    registered_at   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK(status IN ('active', 'under_review', 'suspended'))
);

-- ============================================================
-- Metered / reported generation (daily rows have hour = -1)
-- ============================================================
CREATE TABLE IF NOT EXISTS generation_data (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id          TEXT NOT NULL,
    date              TEXT NOT NULL,             -- YYYY-MM-DD
    hour              INTEGER NOT NULL DEFAULT -1, -- -1 = whole-day total (NULL would defeat UNIQUE)
    generation_kwh    REAL NOT NULL,
    meter_reading_kwh REAL,
    operating_hours   REAL,
    source            TEXT NOT NULL DEFAULT 'meter'
                      CHECK(source IN ('meter', 'manual', 'csv', 'seed')),
    submitted_by      TEXT,
    submitted_at      TEXT NOT NULL,
    UNIQUE(plant_id, date, hour)
);

-- ============================================================
-- Weather observations per plant-day
-- ============================================================
CREATE TABLE IF NOT EXISTS weather_data (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id                 TEXT NOT NULL,
    date                     TEXT NOT NULL,
    temperature_c            REAL,
    humidity_pct             REAL,
    cloud_cover_pct          REAL,
    solar_irradiance_kwh_m2  REAL,
    wind_speed_ms            REAL,
    UNIQUE(plant_id, date)
);

-- ============================================================
-- Model predictions
-- ============================================================
CREATE TABLE IF NOT EXISTS predictions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id          TEXT NOT NULL,
    prediction_time   TEXT NOT NULL,
    target_date       TEXT NOT NULL,
    horizon_hours     INTEGER,
    predicted_kwh     REAL NOT NULL,
    lower_bound_kwh   REAL,
    upper_bound_kwh   REAL,
    model_version     TEXT NOT NULL,
    features_json     TEXT
);

-- ============================================================
-- REC purchase transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id        TEXT PRIMARY KEY,      -- TXN-2026-0001
    cert_id               TEXT,
    seller_plant_id       TEXT,
    buyer_institution_id  TEXT,
    energy_kwh            REAL,
    price_inr             REAL,
    created_at            TEXT NOT NULL
);

-- ============================================================
-- Claims — the unit of government verification
-- ============================================================
CREATE TABLE IF NOT EXISTS claims (
    claim_id               TEXT PRIMARY KEY,     -- CLM-0001
    cert_id                TEXT NOT NULL,        -- certificate ID as submitted
    plant_id               TEXT NOT NULL,
    institution_id         TEXT NOT NULL,
    transaction_id         TEXT,
    period_start           TEXT NOT NULL,
    period_end             TEXT NOT NULL,
    claimed_kwh            REAL NOT NULL,
    expected_kwh           REAL,
    expected_lower_kwh     REAL,
    expected_upper_kwh     REAL,
    actual_kwh             REAL,
    deviation_pct          REAL,                 -- (claimed - expected) / expected * 100
    risk_score             INTEGER,
    risk_level             TEXT,                 -- LOW | MEDIUM | HIGH | CRITICAL
    certificate_status     TEXT,                 -- VALID | TAMPERED | ID_TAMPERED | DUPLICATE | NOT_FOUND | NOT_PROVIDED
    fraud_type             TEXT,                 -- none | inflated_generation | tampered_certificate |
                                                 -- duplicate_claim | certificate_id_tampering | unregistered_certificate
    status                 TEXT NOT NULL
                           CHECK(status IN ('submitted', 'verifying', 'verified', 'flagged',
                                            'evidence_requested', 'approved', 'rejected')),
    decision               TEXT,
    decided_by             TEXT,
    decided_at             TEXT,
    decision_note          TEXT,
    certificate_file_path  TEXT,
    submitted_by           TEXT,
    submitted_at           TEXT NOT NULL,
    updated_at             TEXT NOT NULL
);

-- ============================================================
-- Transparent fraud score per claim
-- ============================================================
CREATE TABLE IF NOT EXISTS fraud_scores (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id           TEXT NOT NULL UNIQUE,
    generation_score   INTEGER NOT NULL,
    historical_score   INTEGER NOT NULL,
    weather_score      INTEGER NOT NULL,
    certificate_score  INTEGER NOT NULL,
    capacity_score     INTEGER NOT NULL,
    total_score        INTEGER NOT NULL,
    risk_level         TEXT NOT NULL,
    explanation_json   TEXT NOT NULL,            -- findings + checks performed
    created_at         TEXT NOT NULL
);

-- ============================================================
-- Certificate security snapshot (last verification of each certificate)
-- ============================================================
CREATE TABLE IF NOT EXISTS certificate_security (
    cert_id             TEXT PRIMARY KEY,
    sha256_hash         TEXT,
    rsa_signature       TEXT,
    steg_payload_json   TEXT,
    steg_verified       INTEGER,
    hash_verified       INTEGER,
    signature_verified  INTEGER,
    ledger_verified     INTEGER,
    claim_verified      INTEGER,
    last_result         TEXT,
    verified_at         TEXT
);

-- ============================================================
-- Investigations
-- ============================================================
CREATE TABLE IF NOT EXISTS investigations (
    case_id           TEXT PRIMARY KEY,          -- INV-0001
    claim_id          TEXT NOT NULL,
    plant_id          TEXT,
    institution_id    TEXT,
    risk_score        INTEGER,
    fraud_type        TEXT,
    assigned_officer  TEXT,
    status            TEXT NOT NULL
                      CHECK(status IN ('open', 'awaiting_evidence', 'resolved_approved', 'resolved_rejected')),
    opened_at         TEXT NOT NULL,
    resolved_at       TEXT,
    resolution_note   TEXT
);

-- ============================================================
-- Tamper-evident audit trail (hash-chained)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp        TEXT NOT NULL,
    actor            TEXT,
    action           TEXT NOT NULL,
    transaction_id   TEXT,
    claim_id         TEXT,
    cert_id          TEXT,
    reference_hash   TEXT,                       -- hash / id the event refers to
    detail           TEXT,
    prev_hash        TEXT,
    entry_hash       TEXT NOT NULL
);

-- ============================================================
-- Runtime settings (risk thresholds / weights) editable by government
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    updated_by  TEXT
);

CREATE INDEX IF NOT EXISTS idx_gen_plant_date ON generation_data(plant_id, date);
CREATE INDEX IF NOT EXISTS idx_weather_plant_date ON weather_data(plant_id, date);
CREATE INDEX IF NOT EXISTS idx_pred_plant ON predictions(plant_id, target_date);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_risk ON claims(risk_level);
CREATE INDEX IF NOT EXISTS idx_claims_plant ON claims(plant_id);
CREATE INDEX IF NOT EXISTS idx_claims_inst ON claims(institution_id);
CREATE INDEX IF NOT EXISTS idx_claims_cert ON claims(cert_id);
CREATE INDEX IF NOT EXISTS idx_inv_status ON investigations(status);
CREATE INDEX IF NOT EXISTS idx_audit_claim ON audit_logs(claim_id);
CREATE INDEX IF NOT EXISTS idx_audit_txn ON audit_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_cert ON audit_logs(cert_id);
"""

USER_ROLES = ("government", "generator", "institution", "issuer", "regulator", "buyer", "auditor", "admin")
