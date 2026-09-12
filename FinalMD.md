# GreenShield — AI-Powered Renewable Energy Verification & REC Fraud Intelligence

## Enhanced Antigravity Build Prompt

You are a senior product architect, UI/UX designer, full-stack engineer, data engineer, and AI/ML product engineer.

I am building a hackathon prototype called **GreenShield — AI-Powered Renewable Energy Verification & REC Fraud Intelligence**.

Your job is to DESIGN AND IMPLEMENT the complete frontend architecture, page structure, dashboards, navigation, user flows, mock backend behavior, verification workflow, AI/ML integration points, REC security workflow, and realistic demo data.

**Do not only describe the system. Build the actual clickable application UI.**

The application should look like a serious government/enterprise renewable-energy verification platform.

---

# 1. IMPORTANT: UNDERSTAND THE TWO DIFFERENT FRAUD DOMAINS

The system has TWO major fraud-detection layers.

## A. Generation-Side Fraud / Over-Claiming

This is checked using AI/ML and energy reconciliation.

A renewable generator reports that it generated a certain amount of energy.

The system independently estimates what the plant could realistically have generated using:

- Weather
- Plant capacity
- Energy type
- Location
- Historical generation
- Time/date
- Other relevant generation features

Then compare:

```text
Reported / Claimed Generation
            VS
AI-Predicted Generation
            VS
Actual Meter / Generation Data
            VS
Plant Capacity / Physical Limits
```

Example:

```text
Plant capacity:        5 MW
Actual generation:     605 MWh
AI predicted:          620 MWh
Claim submitted:       890 MWh
```

This should produce a high-risk anomaly.

This is the **AI/ML module**.

---

# 2. REC ISSUER / CLAIM-SIDE FRAUD

The second fraud domain is REC/certificate manipulation and duplicate use.

Use the attached reference architecture as the conceptual basis.

The reference architecture contains:

```text
MODULE 1 — REC ISSUER

REC Input Data
(CertID, Generator, kWh, Date)
        ↓
SHA-256 Hash + RSA Signature
        ↓
Steganographic Embed
(LSB hidden in PDF/PNG)
        ↓
Register in Ledger
(CertID + hash stored in DB)
        ↓
Issued REC Certificate


MODULE 2 — REC VERIFIER

Upload Suspect REC
(PDF or PNG)
        ↓
Check 1 — Steg Integrity
Extract hidden payload + verify hash
        ↓
Check 2 — Signature Authentication
Validate issuer RSA signature
        ↓
Check 3 — Ledger Lookup
CertID registered? Already claimed?
        ↓
VALID / FRAUD-TAMPERED
        ↓
Shared REC Ledger
```

The system should catch:

1. Tampered documents / changed values
2. Forged certificates
3. Duplicate / double usage of the same REC
4. Unsigned or fake certificates
5. Altered certificate identifiers/payloads

---

# 3. FRAUD TYPE 1 — CHANGING THE ENERGY VALUE

Example:

Original certificate:

```text
CertID: REC-001
Generator: GEN-001
Energy: 100 kWh
Date: 2026-08-10
```

An attacker changes:

```text
Energy: 100 kWh
```

to:

```text
Energy: 1000 kWh
```

The certificate must become invalid.

The intended verification chain is:

```text
Original REC Data
      ↓
SHA-256 Hash
      ↓
RSA Digital Signature
      ↓
Hidden inside PDF/PNG
      ↓
Ledger stores CertID + original hash
```

When the verifier receives the certificate:

```text
Uploaded Certificate
      ↓
Extract hidden payload
      ↓
Recalculate SHA-256
      ↓
Compare with embedded/signed hash
      ↓
Verify RSA signature
      ↓
Compare certificate identity/hash with ledger
```

If the energy value was modified:

```text
Original hash ≠ recalculated hash
```

Therefore:

```text
❌ TAMPERED CERTIFICATE
```

The UI should clearly show:

```text
Original signed value: 100 kWh
Submitted value:       1000 kWh

Hash verification:     FAILED
RSA signature:          INVALID
Ledger match:           FAILED

Result:
🔴 FRAUD / TAMPERED
```

---

# 4. FRAUD TYPE 2 — DOUBLE SELLING / DOUBLE CLAIMING

A certificate/REC should not be claimable twice.

For every REC certificate, maintain a persistent claim state.

Example database concept:

```text
certificate_id
generator_id
energy_kwh
issue_date
hash
signature
claimed
claimed_by
claimed_at
status
```

The important field is:

```text
claimed
```

Possible state:

```text
false → NOT CLAIMED
true  → CLAIMED
```

When a user tries to claim a certificate:

```text
Certificate
    ↓
Lookup CertID
    ↓
Is certificate registered?
    ↓
YES
    ↓
Is claimed = false?
    ↓
YES
    ↓
Mark claimed = true
    ↓
Approve claim
```

If:

```text
claimed = true
```

then:

```text
❌ ERROR
REC ALREADY CLAIMED
```

The UI should show:

```text
Certificate: REC-001

Status:
🔴 ALREADY CLAIMED

Originally claimed by:
Institution ABC

Claimed on:
2026-08-10

Attempted by:
Institution XYZ

Result:
Duplicate claim blocked
```

### IMPORTANT IMPLEMENTATION DETAIL

Do not rely only on frontend validation.

The backend/database should enforce this atomically.

Use:

- Unique certificate ID
- Immutable certificate identifier
- Transaction/locking or an atomic update
- Claim status/state
- Audit record

This prevents two users from claiming the same REC at nearly the same time.

---

# 5. FRAUD TYPE 3 — CHANGING THE PRIMARY KEY / CERTIFICATE ID

Treat the certificate ID / REC ID as an immutable identity.

Example original:

```text
CertID = REC-001
```

Attacker changes it to:

```text
CertID = REC-999
```

The system should NOT simply accept the new value.

The certificate identity should be part of the signed payload.

Verification should therefore include:

```text
Embedded CertID
       ↓
RSA Signature Verification
       ↓
Hash Verification
       ↓
Ledger Lookup
```

If the ID was changed after issuance:

```text
Signature verification → FAILED
Hash verification      → FAILED
Ledger consistency     → FAILED / NO MATCH
```

Result:

```text
🔴 CERTIFICATE ID TAMPERING DETECTED
```

### IMPORTANT DATABASE DESIGN

Do not make a mutable business field the only identity.

Use an immutable internal ID/UUID as the database primary key.

Example:

```text
id                UUID PRIMARY KEY
certificate_id    VARCHAR UNIQUE NOT NULL
energy_kwh        DECIMAL
generator_id      VARCHAR
issued_at         TIMESTAMP
content_hash      VARCHAR
signature         TEXT
claimed           BOOLEAN DEFAULT FALSE
claimed_by        VARCHAR NULL
claimed_at        TIMESTAMP NULL
status            VARCHAR
```

The visible `certificate_id` should also be unique and immutable.

---

# 6. TWO CORE ENGINES

The platform should have two major verification engines.

## Engine A — AI Generation Verification

Purpose:

Determine whether the generation amount is physically/plausibly consistent with the plant.

Inputs:

```text
Plant capacity
Energy type
Location
Date
Time
Solar irradiance
Temperature
Cloud cover
Humidity
Wind speed
Historical generation
Actual meter generation
Reported generation
```

Output:

```text
Expected generation
Confidence/range
Deviation
Anomaly score
Generation risk
```

Example:

```text
AI Expected: 610–650 MWh
Actual:      605 MWh
Claimed:     890 MWh

Generation deviation: HIGH
```

---

# 7. BASIC AI/ML MODEL FOR MVP

For the first working prototype, implement a basic model pipeline.

Do not over-engineer the ML model.

Use a simple supervised regression model such as:

- Random Forest Regressor
- XGBoost Regressor
- LightGBM
- Gradient Boosting Regressor

Preferred MVP:

**Random Forest / XGBoost**

Input features:

```text
capacity_mw
energy_type
latitude
longitude
month
day_of_year
hour
temperature
humidity
cloud_cover
solar_irradiance
wind_speed
historical_generation
```

Target:

```text
generation_kwh / generation_mwh
```

Output:

```text
predicted_generation
```

Also calculate:

```text
deviation_percent =
((reported_generation - predicted_generation)
 / predicted_generation) * 100
```

For production, the model would need properly validated plant-specific datasets and domain constraints. For the hackathon, use realistic mock/training data.

---

# 8. AI FRAUD SCORE

Do not make the ML model itself the only fraud detector.

Use a hybrid system:

```text
                 CLAIM
                   ↓
       ┌───────────┼───────────┐
       ↓           ↓           ↓
     RULES         AI       CRYPTO
    ENGINE       ENGINE     ENGINE
       ↓           ↓           ↓
       └───────────┼───────────┘
                   ↓
             RISK ENGINE
                   ↓
             FINAL RESULT
```

## Rule Engine

Check:

- Claimed generation vs plant capacity
- Claimed vs actual generation
- Claimed vs AI expected generation
- Historical deviation
- Duplicate claim status
- Certificate registration
- Certificate hash
- Signature validity

## AI Engine

Check:

- Expected generation
- Weather-adjusted generation
- Historical anomaly
- Generation deviation

## Crypto/Certificate Engine

Check:

- SHA-256 hash
- RSA signature
- Steganographic payload
- Certificate ID
- Ledger record
- Claim status

---

# 9. FRAUD RISK SCORE

Create a transparent risk score.

Example:

```text
Generation deviation       35 / 40
Historical anomaly         20 / 20
Weather inconsistency      18 / 20
Certificate anomaly        10 / 10
Capacity consistency         8 / 10
                           --------
TOTAL                       91 / 100
```

Risk levels:

```text
0–30      LOW
31–60     MEDIUM
61–80     HIGH
81–100    CRITICAL
```

Make the exact thresholds configurable in code.

Show:

```text
91 / 100
CRITICAL RISK
```

---

# 10. MAIN SYSTEM WORKFLOW

The complete platform should represent:

```text
                 RENEWABLE GENERATOR
                        │
                        │ Generation data
                        ▼
                AI GENERATION MODEL
                        │
                        ▼
               Expected generation
                        │
                        │
                        ▼
               REC ISSUER / CLAIM
                        │
                        │ Certificate
                        ▼
             REC SECURITY LAYER
                        │
           ┌────────────┼─────────────┐
           ↓            ↓             ↓
      SHA-256        RSA Sign     Steganography
           │            │             │
           └────────────┼─────────────┘
                        ▼
                  REC LEDGER
                        │
                        ▼
                 CLAIM SUBMITTED
                        │
                        ▼
              VERIFICATION ENGINE
                        │
          ┌─────────────┼─────────────┐
          ↓             ↓             ↓
      AI CHECK      CRYPTO CHECK   LEDGER CHECK
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                  FRAUD SCORE
                        │
          ┌─────────────┼─────────────┐
          ↓             ↓             ↓
        VALID        REVIEW         FRAUD
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                    GOVERNMENT
                        │
              Approve / Reject /
               Request Evidence
                        │
                        ▼
                  AUDIT TRAIL
```

---

# 11. APPLICATION STRUCTURE

Create role-based navigation.

Three portals:

1. Government Portal
2. Generator / Plant 1 Portal
3. Institution / Claimant / Plant 2 Portal

Users log in and see the correct dashboard for their role.

---

# 12. PUBLIC LANDING PAGE

Route:

`/`

Hero:

**AI-Powered Renewable Energy Verification**

Subtitle:

**Verify renewable energy claims, predict generation, detect certificate tampering, and prevent duplicate REC claims.**

Buttons:

- Government Login
- Generator Login
- Institution Login

Sections:

- AI Generation Prediction
- REC Certificate Security
- Duplicate Claim Prevention
- Fraud Detection
- Government Verification
- Tamper-Evident Audit Trail

Visual:

```text
Generate → Predict → Issue REC → Verify → Detect Fraud → Government Decision
```

---

# 13. LOGIN PAGE

Route:

`/login`

Fields:

- Email
- Password
- Role

Roles:

- Government
- Generator
- Institution

Buttons:

- Sign In
- Demo Government
- Demo Generator
- Demo Institution

---

# 14. GOVERNMENT DASHBOARD

Route:

`/government/dashboard`

This is the primary demo screen.

Sidebar:

- Dashboard
- Claims
- Verification Center
- Investigations
- Plants
- Institutions
- Fraud Network
- Certificates
- Audit Trail
- Analytics
- Settings

KPI cards:

```text
Registered Plants
248

Active Claims
1,284

Verified Energy
2.48 GWh

Pending Verification
74

Suspicious Claims
37

Critical Risk
12
```

Main dashboard sections:

### A. Verification Overview

Chart:

- Verified
- Pending
- Flagged
- Rejected

### B. Claimed vs AI Expected vs Actual

Large chart.

### C. Fraud Risk Distribution

- Low
- Medium
- High
- Critical

### D. Recent High-Risk Claims

Columns:

- Claim ID
- Generator
- Institution
- Claimed
- Expected
- Actual
- Risk
- Status

### E. AI Alerts

Example:

```text
⚠ GEN-014 reported 43.5% above expected generation.

⚠ REC-1022 certificate payload mismatch detected.

⚠ REC-0811 duplicate claim attempt blocked.
```

---

# 15. CLAIMS PAGE

Route:

`/government/claims`

Table:

- Claim ID
- Certificate ID
- Generator
- Institution
- Generation Period
- Claimed Energy
- AI Expected Energy
- Actual Energy
- Risk Score
- Certificate Status
- Claim Status
- Actions

Filters:

- Date
- Generator
- Institution
- Energy type
- Risk
- Certificate status
- Claim status

Search.

Clicking a row opens claim details.

---

# 16. CLAIM VERIFICATION PAGE

Route:

`/government/claims/:id`

This is the HERO SCREEN.

Header:

**Claim Verification — REC-1022**

Top summary:

```text
Generator:        GEN-001
Institution:      INST-045
Certificate:      REC-1022
Generation Date:  2026-08-10

Claimed:
890 MWh

AI Expected:
620 MWh

Actual:
605 MWh

Difference:
+285 MWh

Risk:
92 / 100
CRITICAL
```

Main visualization:

```text
CLAIMED
████████████████████ 890 MWh

AI EXPECTED
██████████████       620 MWh

ACTUAL
█████████████        605 MWh
```

---

# 17. AI EXPLANATION PANEL

Title:

**Why was this claim flagged?**

Show:

```text
✓ Weather data analyzed
✓ Historical generation analyzed
✓ Plant capacity analyzed
✓ Actual generation analyzed
✓ Claim compared against expected output
```

Findings:

```text
HIGH
Claim is 43.5% above AI expected generation.

HIGH
Claim is inconsistent with historical generation.

MEDIUM
Weather conditions indicate lower generation potential.

HIGH
Actual meter generation is below claimed generation.
```

Risk contribution chart:

```text
Generation deviation       35 / 40
Historical anomaly         20 / 20
Weather inconsistency      18 / 20
Certificate anomaly        10 / 10
Capacity consistency         8 / 10
```

---

# 18. CERTIFICATE SECURITY PANEL

On the same claim verification screen, show a separate certificate verification section.

```text
REC SECURITY VERIFICATION

Steganographic Payload
✓ Extracted

SHA-256 Hash
✓ MATCH

RSA Signature
✓ VALID

Certificate ID
✓ REGISTERED

Ledger Status
✓ NOT MODIFIED

Claim Status
✓ NOT PREVIOUSLY CLAIMED
```

For a tampered demo certificate:

```text
Steganographic Payload
✓ Extracted

SHA-256 Hash
✗ MISMATCH

RSA Signature
✗ INVALID

Certificate ID
✓ REGISTERED

Ledger Hash
✗ DOES NOT MATCH

Result:
🔴 TAMPERED CERTIFICATE
```

---

# 19. GOVERNMENT INVESTIGATION CENTER

Route:

`/government/investigations`

Cards:

- Open Investigations
- Critical Cases
- Awaiting Evidence
- Resolved

Table:

- Case ID
- Claim
- Generator
- Institution
- Risk
- Fraud Type
- Assigned Officer
- Status

Detail page:

`/government/investigations/:id`

Show:

- Case summary
- AI evidence
- Certificate evidence
- Generation evidence
- Weather evidence
- Ledger evidence
- Historical claims
- Related entities
- Audit history

Actions:

- Approve
- Reject
- Request More Data

Use a confirmation dialog.

---

# 20. PLANT REGISTRY

Route:

`/government/plants`

Columns:

- Plant ID
- Plant Name
- Energy Type
- Location
- Installed Capacity
- Generation
- Claims
- Flagged Claims
- Risk
- Status

Filters:

- Solar
- Wind
- Hydro
- Other

---

# 21. PLANT PROFILE

Route:

`/government/plants/:id`

Show:

- Plant ID
- Name
- Location
- Energy type
- Installed capacity
- Registration date

KPIs:

- Total generation
- Average generation
- Total claims
- Flagged claims
- Average risk

Charts:

- Actual vs AI predicted
- Monthly generation
- Anomalies
- Weather vs generation

Weather card:

- Solar irradiance
- Temperature
- Cloud cover
- Humidity
- Wind speed

---

# 22. FRAUD NETWORK

Route:

`/government/fraud-network`

Create a relationship graph between:

- Institutions
- Generators
- Certificates
- Claims

Example:

```text
             Institution B
             /     |      \
            /      |       \
           ↓       ↓        ↓
       Plant A   Plant C   Plant F
        92%       87%       91%
```

Use wording:

**Potentially Suspicious Relationship**

Never label a relationship as confirmed criminal collusion based only on the graph.

Clicking an entity should show:

- Number of claims
- Total energy
- Flagged claims
- Common certificates
- Risk history

---

# 23. CERTIFICATE VERIFICATION PAGE

Route:

`/government/certificates`

Search by:

- Certificate ID

Result:

```text
Certificate:
REC-829182

Generator:
GEN-001

Institution:
INST-045

Energy:
890 MWh

AI Expected:
610–650 MWh

Actual:
605 MWh

Hash:
MATCH / MISMATCH

RSA:
VALID / INVALID

Steganography:
VALID / INVALID

Ledger:
REGISTERED / NOT FOUND

Claim:
CLAIMED / NOT CLAIMED

Final:
VALID / TAMPERED / DUPLICATE
```

---

# 24. AUDIT TRAIL

Route:

`/government/audit`

Timeline:

```text
10:42
Certificate submitted

10:43
Steganographic payload extracted

10:43
SHA-256 hash verified

10:44
RSA signature verified

10:44
Ledger lookup completed

10:44
AI prediction generated

10:45
Fraud score calculated

10:46
Government review started

10:49
Claim rejected
```

Each event:

- Timestamp
- User
- Action
- Transaction ID
- Certificate ID
- Hash/reference

Label the system:

**Tamper-Evident Audit Trail**

---

# 25. GOVERNMENT ANALYTICS

Route:

`/government/analytics`

Charts:

- Renewable generation by month
- Claims by month
- Verified energy
- Rejected energy
- Fraud detection rate
- Average fraud score
- Top suspicious generators
- Top suspicious institutions
- Claim deviation distribution
- Certificate tampering attempts
- Duplicate claim attempts

Filters:

- Date range
- Energy type
- State/location

---

# 26. GENERATOR / PLANT 1 DASHBOARD

Route:

`/generator/dashboard`

Sidebar:

- Dashboard
- Generation
- Forecast
- Submit Data
- Claims
- Plant Profile

Show:

```text
Plant A
5 MW
Solar
Gujarat

Today's Generation:
18.4 MWh

AI Expected:
17.9 MWh

Deviation:
+2.8%

Status:
NORMAL
```

Charts:

- Today
- 7 days
- 30 days
- Weather
- Forecast

---

# 27. GENERATOR FORECAST

Route:

`/generator/forecast`

Show:

```text
Next 24 Hours
18.4 MWh

Next 48 Hours
19.1 MWh

Next 72 Hours
17.8 MWh
```

Confidence:

```text
Expected:
19.1 MWh

Expected Range:
18.2–20.0 MWh
```

Use an interactive line chart.

---

# 28. GENERATION DATA

Route:

`/generator/generation`

Features:

- Historical table
- Date filter
- CSV upload
- Manual entry

Fields:

```text
Date
Time
Generation
Meter Reading
Operating Hours
```

Button:

**Upload Generation Data**

---

# 29. INSTITUTION / CLAIMANT DASHBOARD

Route:

`/institution/dashboard`

Sidebar:

- Dashboard
- Submit Claim
- Claims
- Certificates
- Transactions
- Profile

KPIs:

- Total Purchased Energy
- Verified Energy
- Pending Claims
- Flagged Claims
- Duplicate Attempts

---

# 30. SUBMIT CLAIM

Route:

`/institution/claims/new`

Fields:

- Generator Plant ID
- Certificate ID
- Transaction ID
- Generation period
- Claimed renewable energy
- Certificate upload

Before submission:

> Your claim will be automatically verified against generation, weather, AI predictions, certificate cryptography, and the REC ledger.

Button:

**Submit for Verification**

---

# 31. CLAIM STATUS

Route:

`/institution/claims/:id`

Timeline:

```text
Claim Submitted
      ↓
Certificate Validation
      ↓
Steganographic Verification
      ↓
Hash Verification
      ↓
RSA Signature Verification
      ↓
Ledger Lookup
      ↓
AI Generation Verification
      ↓
Fraud Analysis
      ↓
Government Review
      ↓
Final Decision
```

Status:

- Submitted
- Verifying
- Verified
- Flagged
- Rejected

---

# 32. INSTITUTION CERTIFICATES

Route:

`/institution/certificates`

Table:

- Certificate ID
- Generator
- Energy
- Date
- Hash status
- Signature status
- Claim status
- Final status

---

# 33. REC ISSUER MODULE

Create an issuer workflow/page.

Route:

`/issuer/create-rec`

Form:

```text
Certificate ID
Generator ID
Energy kWh
Generation Date
Generation Period
Energy Type
```

Button:

**Issue REC**

After submission, visually show:

```text
REC Input Data
      ↓
SHA-256 Hash
      ↓
RSA Digital Signature
      ↓
Steganographic Embedding
      ↓
Ledger Registration
      ↓
REC Issued
```

Result:

```text
REC-001
Successfully Issued

Hash:
abc123...

Signature:
VALID

Ledger:
REGISTERED

Claim Status:
NOT CLAIMED
```

---

# 34. REC VERIFIER MODULE

Create a dedicated verification screen.

Route:

`/verifier`

Allow upload:

- PDF
- PNG

After upload show:

```text
STEP 1
Steganographic Integrity
Extract hidden payload
Verify hash

STEP 2
Signature Authentication
Validate RSA signature

STEP 3
Ledger Lookup
Check certificate registration
Check whether already claimed

STEP 4
Generation Reconciliation
Compare claimed energy with AI/actual generation

FINAL RESULT
```

Possible outcomes:

### Valid

```text
✓ VALID REC

Hash: MATCH
RSA: VALID
Ledger: REGISTERED
Claimed: NO
Generation: CONSISTENT
```

### Tampered

```text
✗ FRAUD / TAMPERED

Hash: MISMATCH
RSA: INVALID
Ledger: MISMATCH
```

### Duplicate

```text
✗ DUPLICATE CLAIM

Certificate is already marked as CLAIMED.
```

---

# 35. DATABASE ARCHITECTURE

Use PostgreSQL or SQLite for the MVP.

Core tables:

```text
users
plants
institutions
generation_data
weather_data
certificates
certificate_security
claims
predictions
fraud_scores
investigations
audit_logs
transactions
```

Recommended certificate structure:

```text
certificates
-----------------------------
id                  UUID PRIMARY KEY
certificate_id      VARCHAR UNIQUE
generator_id        VARCHAR
energy_kwh          DECIMAL
issue_date          TIMESTAMP
generation_start    TIMESTAMP
generation_end      TIMESTAMP
content_hash        VARCHAR
signature           TEXT
claimed             BOOLEAN DEFAULT FALSE
claimed_by          VARCHAR NULL
claimed_at          TIMESTAMP NULL
status              VARCHAR
created_at          TIMESTAMP
```

Certificate security:

```text
certificate_security
-----------------------------
certificate_id
sha256_hash
rsa_signature
steg_payload
hash_verified
signature_verified
steg_verified
ledger_verified
```

Claims:

```text
claims
-----------------------------
id
certificate_id
institution_id
claimed_energy
submitted_at
status
risk_score
decision
```

Predictions:

```text
predictions
-----------------------------
id
plant_id
prediction_time
predicted_energy
lower_bound
upper_bound
model_version
```

Fraud score:

```text
fraud_scores
-----------------------------
id
claim_id
generation_score
historical_score
weather_score
certificate_score
capacity_score
total_score
risk_level
explanation
created_at
```

---

# 36. API ARCHITECTURE

Create mock services initially.

Suggested APIs:

```text
POST /auth/login

POST /plants
GET /plants
GET /plants/:id

POST /generation
GET /generation/:plantId

POST /prediction/generation

POST /claims
GET /claims
GET /claims/:id

POST /certificates
GET /certificates/:id
POST /certificates/:id/verify

POST /rec/issue
POST /rec/verify

POST /fraud/analyze

GET /investigations
POST /investigations/:id/decision

GET /audit/:transactionId

GET /dashboard/government
```

---

# 37. ML SERVICE ARCHITECTURE

Keep the ML service separate from the frontend.

Recommended:

```text
Frontend
   ↓
Backend API
   ↓
ML Service / FastAPI
   ↓
Generation Prediction Model
   ↓
Fraud Analysis
```

Possible model endpoints:

```text
POST /ml/predict-generation
POST /ml/anomaly-score
POST /ml/fraud-score
```

---

# 38. MOCK ML DATA

For the demo, generate realistic synthetic data.

Include:

- Solar plants
- Wind plants
- Different capacities
- Historical generation
- Weather
- Normal generation
- Abnormally high claims
- Abnormally low claims

Make at least three obvious high-risk cases.

---

# 39. DEMO FRAUD CASES

## Case A — Inflated Energy

```text
Plant:
GEN-001

Capacity:
5 MW

Actual:
605 MWh

AI Expected:
620 MWh

Claim:
890 MWh

Risk:
92 / 100
```

Fraud reason:

**Claim significantly exceeds expected and actual generation.**

---

## Case B — Tampered Certificate

Original:

```text
REC-002
Energy = 100 kWh
```

Tampered:

```text
REC-002
Energy = 1000 kWh
```

Expected UI:

```text
SHA-256:
✗ MISMATCH

RSA:
✗ INVALID

Ledger:
✗ MISMATCH

RESULT:
TAMPERED CERTIFICATE
```

---

## Case C — Duplicate Claim

First claim:

```text
REC-003
Status → CLAIMED
```

Second attempt:

```text
REC-003
Status → CLAIMED

RESULT:
❌ DUPLICATE CLAIM BLOCKED
```

---

## Case D — Certificate ID Tampering

Original:

```text
REC-004
```

Tampered:

```text
REC-999
```

Expected:

```text
Signature:
✗ INVALID

Hash:
✗ MISMATCH

Ledger:
✗ NO MATCH

RESULT:
CERTIFICATE ID TAMPERING DETECTED
```

---

# 40. GLOBAL UI COMPONENTS

Build reusable:

- Sidebar
- Top navbar
- KPI card
- Risk badge
- Status badge
- Data table
- Search
- Filters
- Modal
- Confirmation dialog
- Chart card
- Line chart
- Bar chart
- Donut chart
- Risk gauge
- Timeline
- AI explanation card
- Energy comparison card
- Weather card
- Certificate card
- Security verification card
- Hash status indicator
- RSA status indicator
- Ledger status indicator
- Claim status indicator
- Network graph
- Evidence card

---

# 41. RISK COLOR SYSTEM

Use semantic colors:

```text
LOW       → Green
MEDIUM    → Amber
HIGH      → Orange/Red
CRITICAL  → Red
VALID     → Green
TAMPERED  → Red
DUPLICATE → Red
PENDING   → Amber
```

Do not make the entire interface red.

Use warning colors only for meaningful risk.

---

# 42. MOST IMPORTANT VISUAL

Across the platform, make this comparison visually prominent:

```text
CLAIMED ENERGY
VS
AI EXPECTED ENERGY
VS
ACTUAL ENERGY
```

Example:

```text
Claimed       ████████████████████ 890 MWh
AI Expected   ██████████████       620 MWh
Actual        █████████████        605 MWh
```

---

# 43. SECOND MOST IMPORTANT VISUAL

For REC verification, make this equally clear:

```text
STEGANOGRAPHY
     ↓
HASH
     ↓
RSA SIGNATURE
     ↓
LEDGER
     ↓
CLAIM STATUS
```

Show each as:

```text
✓ VERIFIED
✗ FAILED
⚠ WARNING
```

---

# 44. DEMO DATA

Populate:

- 10+ renewable plants
- 10+ institutions
- 30+ claims
- 20+ certificates
- Historical generation data
- Weather data
- Predictions
- Fraud scores
- Investigations
- Audit events

Include:

- Normal
- Medium-risk
- High-risk
- Critical
- Tampered
- Duplicate

cases.

---

# 45. TECH STACK

Preferred:

```text
Frontend:
Next.js / React
TypeScript
Tailwind CSS

UI:
Modern component library
Lucide icons

Charts:
Recharts

Backend:
Node.js / FastAPI

Database:
PostgreSQL
SQLite acceptable for MVP

ML:
Python
scikit-learn
XGBoost / Random Forest

Crypto:
SHA-256
RSA

File:
PDF/PNG certificate handling
```

Keep the architecture modular.

---

# 46. FOLDER STRUCTURE

Prefer:

```text
src/
├── app/
│   ├── login/
│   ├── government/
│   ├── generator/
│   ├── institution/
│   ├── issuer/
│   └── verifier/
│
├── components/
│   ├── dashboard/
│   ├── charts/
│   ├── claims/
│   ├── certificates/
│   ├── security/
│   ├── fraud/
│   └── common/
│
├── services/
│   ├── api/
│   ├── ml/
│   ├── certificate/
│   └── ledger/
│
├── data/
│   └── mock/
│
├── types/
│
└── lib/
```

---

# 47. RESPONSIVENESS

Support:

- Desktop
- Laptop
- Tablet

Prioritize desktop for the government dashboard because that is the main hackathon demonstration environment.

---

# 48. UX REQUIREMENTS

Everything important must be clickable.

Implement:

- Working navigation
- Working filters
- Working search
- Claim detail navigation
- Investigation navigation
- Certificate verification
- Mock claim submission
- Mock duplicate-claim prevention
- Mock certificate verification
- Government approve/reject actions
- Audit trail updates

Do not create dead buttons or dead pages.

---

# 49. PRIMARY GOVERNMENT DEMO JOURNEY

Implement this exact flow:

```text
Government Login
      ↓
Government Dashboard
      ↓
See CRITICAL claim
      ↓
Open Claim
      ↓
View:
Claimed vs AI Expected vs Actual
      ↓
View:
AI explanation
      ↓
View:
Certificate security checks
      ↓
Open Investigation
      ↓
Review evidence
      ↓
Reject Claim
      ↓
Audit Trail updated
```

---

# 50. CERTIFICATE FRAUD DEMO JOURNEY

Implement:

```text
Open REC Verifier
      ↓
Upload suspect certificate
      ↓
Extract steganographic payload
      ↓
Verify SHA-256
      ↓
Verify RSA signature
      ↓
Lookup ledger
      ↓
Check claimed status
      ↓
Show final verdict
```

For a tampered certificate:

```text
Hash mismatch
+
RSA invalid
+
Ledger mismatch
=
🔴 TAMPERED
```

---

# 51. DUPLICATE CLAIM DEMO JOURNEY

Implement:

```text
Institution submits REC-003
      ↓
Database lookup
      ↓
claimed = false
      ↓
Claim approved
      ↓
claimed = true
      ↓
Second institution submits REC-003
      ↓
Database lookup
      ↓
claimed = true
      ↓
❌ Duplicate claim blocked
```

Show this clearly in the UI.

---

# 52. GENERATION FRAUD DEMO JOURNEY

Implement:

```text
Generator submits generation
      ↓
Weather data
      ↓
AI model
      ↓
Expected generation
      ↓
Compare with actual
      ↓
Institution claim
      ↓
Compare claim with expected + actual
      ↓
Fraud score
      ↓
Government review
```

---

# 53. SECURITY / CRYPTOGRAPHY NOTE

Treat cryptographic verification as a security layer, not as the AI fraud model.

The AI model detects **generation anomalies**.

The certificate system detects **document/payload tampering and authenticity problems**.

The ledger/state system detects **registration and duplicate usage**.

The final risk engine combines these signals.

This separation should be visible in the architecture and UI.

---

# 54. FINAL PRODUCT POSITIONING

Product name:

# GreenShield

Subtitle:

**AI-Powered Renewable Energy Verification & Fraud Intelligence**

Core message:

> **Don't trust the claim. Verify it against reality.**

The system should communicate three independent questions:

### 1. Did the plant actually generate this much energy?

AI + weather + historical + actual generation.

### 2. Is the REC/certificate authentic and untampered?

SHA-256 + RSA + steganographic payload + ledger.

### 3. Has this REC already been claimed?

Certificate ID + ledger + claim status + database constraints.

Then combine the results into:

**One government verification decision.**

---

# 55. HACKATHON PRIORITY

Do NOT spend most effort on the landing page.

Prioritize:

1. Government Dashboard
2. Claim Verification
3. AI Generation Analysis
4. Certificate Security Verification
5. Investigation Center
6. Duplicate Claim Prevention
7. Fraud Network
8. Audit Trail
9. Generator Dashboard
10. Institution Claim Submission
11. REC Issuer
12. Landing Page

The **Government Claim Verification** screen is the hero screen.

When a judge opens a suspicious claim, they should immediately understand:

- What was claimed?
- What could the plant realistically generate?
- What did it actually generate?
- Is the certificate authentic?
- Has the certificate already been claimed?
- Why is the claim suspicious?
- What should the government do?

All of these should be visible with minimal scrolling.

---

# 56. FINAL IMPLEMENTATION INSTRUCTION

Build the complete clickable frontend now.

Use realistic mock data and mock service calls if the real backend/ML model is not yet available.

Create clear interfaces so that the actual AI model can later replace the mock prediction service without redesigning the frontend.

Do not fake security results in the UI as if they were real cryptographic verification if the implementation is only mocked. Clearly structure the code so the real SHA-256, RSA, steganography, ledger, and ML services can be plugged in later.

Verify that:

- Every major navigation item works
- Every major dashboard loads
- Claim details work
- Certificate verification works
- Duplicate claim behavior works
- Government decisions work
- Audit trail updates
- The primary demo flow is fully clickable
- The UI is polished and presentation-ready

The final product should feel like a real government-grade renewable-energy verification and fraud-intelligence platform, not a generic admin dashboard.
