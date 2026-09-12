/**
 * Sample data for mock mode (VITE_MOCK_API=true) and tests. Mirrors what
 * backend/scripts/seed_greenshield.py produces so the UI looks the same either way.
 * Everything here is clearly marked as sample data in the UI (see SampleDataBadge).
 */
import type {
  Alert, Analytics, AuditEvent, CertificateDetail, CertificateListRow, Claim, ClaimDetailResponse, Forecast, FraudNetwork,
  GeneratorDashboard, GovernmentDashboard, Institution, InstitutionDashboard, Investigation, InvestigationDetail, IssueResult,
  PlantProfile, PlantWithStats, Session, VerifyResult,
} from '@/types';

const T0 = '2026-09-12T08:00:00+00:00';

export const plants: PlantWithStats[] = [
  { plant_id: 'GEN-001', name: 'Kutch Solar Park A', energy_type: 'Solar', capacity_mw: 5, location: 'Bhuj, Gujarat', state: 'Gujarat', latitude: 23.24, longitude: 69.67, operator_email: 'ops@gen-001.in', registered_at: '2025-02-15T00:00:00+00:00', status: 'active', generation_kwh: 1_281_000, generation_days: 90, claims: 4, flagged_claims: 2, avg_risk: 40, max_risk: 90 },
  { plant_id: 'GEN-002', name: 'Jaisalmer Wind Farm', energy_type: 'Wind', capacity_mw: 25, location: 'Jaisalmer, Rajasthan', state: 'Rajasthan', latitude: 26.92, longitude: 70.91, operator_email: 'ops@gen-002.in', registered_at: '2025-03-15T00:00:00+00:00', status: 'active', generation_kwh: 6_405_000, generation_days: 90, claims: 2, flagged_claims: 0, avg_risk: 19, max_risk: 21 },
  { plant_id: 'GEN-003', name: 'Tirunelveli Wind Cluster', energy_type: 'Wind', capacity_mw: 50, location: 'Tirunelveli, Tamil Nadu', state: 'Tamil Nadu', latitude: 8.73, longitude: 77.7, operator_email: 'ops@gen-003.in', registered_at: '2025-04-15T00:00:00+00:00', status: 'active', generation_kwh: 8_903_000, generation_days: 90, claims: 2, flagged_claims: 1, avg_risk: 51, max_risk: 82 },
  { plant_id: 'GEN-004', name: 'Bhadla Solar Block B', energy_type: 'Solar', capacity_mw: 100, location: 'Bhadla, Rajasthan', state: 'Rajasthan', latitude: 27.53, longitude: 71.91, operator_email: 'ops@gen-004.in', registered_at: '2025-05-15T00:00:00+00:00', status: 'active', generation_kwh: 25_103_000, generation_days: 90, claims: 2, flagged_claims: 0, avg_risk: 19, max_risk: 38 },
  { plant_id: 'GEN-005', name: 'Pavagada Solar Unit 3', energy_type: 'Solar', capacity_mw: 50, location: 'Pavagada, Karnataka', state: 'Karnataka', latitude: 14.1, longitude: 77.28, operator_email: 'ops@gen-005.in', registered_at: '2025-06-15T00:00:00+00:00', status: 'active', generation_kwh: 13_184_000, generation_days: 90, claims: 3, flagged_claims: 1, avg_risk: 38, max_risk: 73 },
  { plant_id: 'GEN-006', name: 'Satara Ridge Wind', energy_type: 'Wind', capacity_mw: 10, location: 'Satara, Maharashtra', state: 'Maharashtra', latitude: 17.68, longitude: 73.99, operator_email: 'ops@gen-006.in', registered_at: '2025-07-15T00:00:00+00:00', status: 'under_review', generation_kwh: 2_476_000, generation_days: 90, claims: 3, flagged_claims: 2, avg_risk: 52, max_risk: 90 },
  { plant_id: 'GEN-007', name: 'Tehri Hydro Unit 2', energy_type: 'Hydro', capacity_mw: 25, location: 'Tehri, Uttarakhand', state: 'Uttarakhand', latitude: 30.38, longitude: 78.48, operator_email: 'ops@gen-007.in', registered_at: '2025-08-15T00:00:00+00:00', status: 'active', generation_kwh: 28_197_000, generation_days: 90, claims: 2, flagged_claims: 0, avg_risk: 3, max_risk: 6 },
  { plant_id: 'GEN-009', name: 'Anantapur Solar', energy_type: 'Solar', capacity_mw: 10, location: 'Anantapur, Andhra Pradesh', state: 'Andhra Pradesh', latitude: 14.68, longitude: 77.6, operator_email: 'ops@gen-009.in', registered_at: '2025-09-15T00:00:00+00:00', status: 'active', generation_kwh: 2_598_000, generation_days: 90, claims: 4, flagged_claims: 1, avg_risk: 24, max_risk: 90 },
];

export const institutions: Institution[] = [
  { institution_id: 'INST-045', name: 'Acme Steel Ltd', sector: 'Manufacturing', location: 'Ahmedabad, Gujarat', contact_email: 'claims@inst-045.org', registered_at: '2025-03-01T00:00:00+00:00', status: 'active' },
  { institution_id: 'INST-012', name: 'Nimbus Data Centres', sector: 'IT & Cloud', location: 'Bengaluru, Karnataka', contact_email: 'esg@nimbusdc.in', registered_at: '2025-03-01T00:00:00+00:00', status: 'active' },
  { institution_id: 'INST-018', name: 'Sunrise Textiles', sector: 'Textiles', location: 'Surat, Gujarat', contact_email: 'green@sunrisetex.in', registered_at: '2025-03-01T00:00:00+00:00', status: 'active' },
  { institution_id: 'INST-042', name: 'GreenTech Ltd', sector: 'Technology', location: 'Pune, Maharashtra', contact_email: 'compliance@greentech.in', registered_at: '2025-03-01T00:00:00+00:00', status: 'active' },
  { institution_id: 'INST-050', name: 'Northwind Retail', sector: 'Retail', location: 'Delhi', contact_email: 'energy@northwindretail.in', registered_at: '2025-03-01T00:00:00+00:00', status: 'active' },
];

const baseClaim = (over: Partial<Claim> & Pick<Claim, 'claim_id' | 'cert_id' | 'plant_id' | 'institution_id' | 'claimed_kwh' | 'status'>): Claim => ({
  transaction_id: `TXN-2026-${over.claim_id.slice(-4)}`,
  period_start: '2026-08-01', period_end: '2026-08-31',
  expected_kwh: null, expected_lower_kwh: null, expected_upper_kwh: null, actual_kwh: null, deviation_pct: null,
  risk_score: null, risk_level: null, certificate_status: 'VALID', fraud_type: 'none', decision: null, decided_by: null, decided_at: null,
  decision_note: null, certificate_file_path: null, submitted_by: over.institution_id, submitted_at: T0, updated_at: T0,
  plant_name: plants.find((p) => p.plant_id === over.plant_id)?.name ?? over.plant_id,
  energy_type: plants.find((p) => p.plant_id === over.plant_id)?.energy_type ?? 'Solar',
  capacity_mw: plants.find((p) => p.plant_id === over.plant_id)?.capacity_mw ?? 5,
  institution_name: institutions.find((i) => i.institution_id === over.institution_id)?.name ?? over.institution_id,
  ...over,
});

export const heroClaim: Claim = baseClaim({
  claim_id: 'CLM-0001', cert_id: 'REC-1022', plant_id: 'GEN-001', institution_id: 'INST-045', claimed_kwh: 890_000, status: 'flagged',
  expected_kwh: 620_000, expected_lower_kwh: 590_000, expected_upper_kwh: 651_000, actual_kwh: 605_000, deviation_pct: 43.5,
  risk_score: 92, risk_level: 'CRITICAL', fraud_type: 'inflated_generation', case_id: 'INV-0001', investigation_status: 'open',
  submitted_at: '2026-09-11T10:42:00+00:00', updated_at: '2026-09-11T10:45:00+00:00',
  fraud_score: {
    total: 92, level: 'CRITICAL',
    components: { generation: 35, historical: 20, weather: 18, certificate: 10, capacity: 9 },
    weights: { generation: 40, historical: 20, weather: 20, certificate: 10, capacity: 10 },
    thresholds: { LOW: 30, MEDIUM: 60, HIGH: 80 },
    findings: [
      { severity: 'HIGH', text: 'Claim is 43.5% above AI expected generation.' },
      { severity: 'HIGH', text: 'Claim is inconsistent with historical generation.' },
      { severity: 'HIGH', text: 'Actual meter generation is 47.1% below the claimed amount.' },
      { severity: 'MEDIUM', text: 'Weather conditions indicate lower generation potential.' },
      { severity: 'OK', text: 'Certificate is authentic, registered and not previously claimed.' },
    ],
    checks: ['Weather data analyzed', 'Historical generation analyzed', 'Plant capacity analyzed', 'Actual generation analyzed', 'Claim compared against expected output', 'Certificate cryptography and ledger checked'],
    metrics: { claimed_kwh: 890_000, expected_kwh: 620_000, actual_kwh: 605_000, historical_expected_kwh: 600_000, deviation_vs_expected_pct: 43.5, deviation_vs_historical_pct: 48.3, deviation_vs_actual_pct: 47.1, capacity_max_kwh: 3_720_000, certificate_status: 'VALID' },
    certificate: { status: 'VALID', reason: 'Payload, hash, signature and ledger all agree; not previously claimed.', checks: { steganography: true, hash: true, signature: true, ledger: true, claim_state: true } },
  },
  certificate_security: { cert_id: 'REC-1022', sha256_hash: 'c9f0f895fb98ab9159f51fd0297e236d570bfa2c72a43571f1e5c68d96e9f2a3', rsa_signature: 'MEUCIQCrGYe2aB…', steg_payload_json: null, steg_verified: 1, hash_verified: 1, signature_verified: 1, ledger_verified: 1, claim_verified: 1, last_result: 'VALID', verified_at: T0 },
  ledger_record: { cert_id: 'REC-1022', generator_id: 'GEN-001', source_type: 'Solar', energy_kwh: 605_000, generation_date: '2026-08-31', issuer_id: 'ISSUER-NREC-01', data_hash: 'c9f0f895fb98ab9159f51fd0297e236d570bfa2c72a43571f1e5c68d96e9f2a3', status: 'issued', issued_at: '2026-09-01T09:00:00+00:00', claimed_by: null, claimed_at: null, cert_file_path: '/app/storage/certificates/REC-1022.png' },
});

export const claims: Claim[] = [
  heroClaim,
  baseClaim({ claim_id: 'CLM-0002', cert_id: 'REC-002', plant_id: 'GEN-009', institution_id: 'INST-018', claimed_kwh: 1000, status: 'flagged', period_start: '2026-08-10', period_end: '2026-08-10', expected_kwh: 29_900, actual_kwh: 28_800, deviation_pct: -96.7, risk_score: 90, risk_level: 'CRITICAL', certificate_status: 'TAMPERED', fraud_type: 'tampered_certificate', case_id: 'INV-0002', investigation_status: 'open' }),
  baseClaim({ claim_id: 'CLM-0003', cert_id: 'REC-003', plant_id: 'GEN-009', institution_id: 'INST-012', claimed_kwh: 948_300, status: 'verified', period_start: '2026-07-01', period_end: '2026-07-31', expected_kwh: 934_200, actual_kwh: 938_900, deviation_pct: 1.5, risk_score: 3, risk_level: 'LOW', decision: 'auto_verified' }),
  baseClaim({ claim_id: 'CLM-0004', cert_id: 'REC-003', plant_id: 'GEN-009', institution_id: 'INST-042', claimed_kwh: 938_900, status: 'rejected', period_start: '2026-07-01', period_end: '2026-07-31', expected_kwh: 934_200, actual_kwh: 938_900, deviation_pct: 0.5, risk_score: 90, risk_level: 'CRITICAL', certificate_status: 'DUPLICATE', fraud_type: 'duplicate_claim', decision: 'duplicate_blocked', decision_note: 'Already claimed by INST-012 on 2026-09-03.' }),
  baseClaim({ claim_id: 'CLM-0005', cert_id: 'REC-999', plant_id: 'GEN-006', institution_id: 'INST-050', claimed_kwh: 821_300, status: 'flagged', period_start: '2026-07-01', period_end: '2026-07-31', expected_kwh: 820_700, actual_kwh: 821_300, deviation_pct: 0.1, risk_score: 90, risk_level: 'CRITICAL', certificate_status: 'ID_TAMPERED', fraud_type: 'certificate_id_tampering', case_id: 'INV-0003', investigation_status: 'open' }),
  baseClaim({ claim_id: 'CLM-0006', cert_id: 'REC-001', plant_id: 'GEN-001', institution_id: 'INST-045', claimed_kwh: 460_700, status: 'verified', period_start: '2026-07-01', period_end: '2026-07-31', expected_kwh: 455_800, actual_kwh: 463_000, deviation_pct: 1.1, risk_score: 2, risk_level: 'LOW', decision: 'auto_verified' }),
  baseClaim({ claim_id: 'CLM-0007', cert_id: 'REC-7777', plant_id: 'GEN-005', institution_id: 'INST-012', claimed_kwh: 5_000_000, status: 'rejected', expected_kwh: 3_801_800, actual_kwh: 3_720_700, deviation_pct: 31.5, risk_score: 73, risk_level: 'HIGH', certificate_status: 'NOT_FOUND', fraud_type: 'unregistered_certificate', decision: 'reject', decided_by: 'gov@greenshield.gov', decision_note: 'Certificate ID is not registered with the national REC registry.' }),
  baseClaim({ claim_id: 'CLM-0013', cert_id: 'REC-2006', plant_id: 'GEN-003', institution_id: 'INST-050', claimed_kwh: 8_168_600, status: 'evidence_requested', expected_kwh: 4_904_500, actual_kwh: 4_691_300, deviation_pct: 66.5, risk_score: 82, risk_level: 'CRITICAL', fraud_type: 'inflated_generation', case_id: 'INV-0004', investigation_status: 'awaiting_evidence' }),
  baseClaim({ claim_id: 'CLM-0014', cert_id: 'REC-2007', plant_id: 'GEN-004', institution_id: 'INST-045', claimed_kwh: 11_351_300, status: 'verified', expected_kwh: 9_426_200, actual_kwh: 9_195_600, deviation_pct: 20.4, risk_score: 38, risk_level: 'MEDIUM', decision: 'auto_verified' }),
  baseClaim({ claim_id: 'CLM-0020', cert_id: 'REC-2013', plant_id: 'GEN-007', institution_id: 'INST-042', claimed_kwh: 9_322_600, status: 'verified', expected_kwh: 9_375_900, actual_kwh: 9_363_100, deviation_pct: -0.6, risk_score: 6, risk_level: 'LOW', decision: 'auto_verified' }),
];

export const investigations: Investigation[] = [
  { case_id: 'INV-0001', claim_id: 'CLM-0001', plant_id: 'GEN-001', institution_id: 'INST-045', risk_score: 92, fraud_type: 'inflated_generation', assigned_officer: 'Officer A. Mehta', status: 'open', opened_at: '2026-09-11T10:45:00+00:00', resolved_at: null, resolution_note: null, cert_id: 'REC-1022', claimed_kwh: 890_000, expected_kwh: 620_000, actual_kwh: 605_000, risk_level: 'CRITICAL', claim_status: 'flagged', plant_name: 'Kutch Solar Park A', institution_name: 'Acme Steel Ltd' },
  { case_id: 'INV-0002', claim_id: 'CLM-0002', plant_id: 'GEN-009', institution_id: 'INST-018', risk_score: 90, fraud_type: 'tampered_certificate', assigned_officer: 'Officer R. Iyer', status: 'open', opened_at: '2026-09-10T09:12:00+00:00', resolved_at: null, resolution_note: null, cert_id: 'REC-002', claimed_kwh: 1000, expected_kwh: 29_900, actual_kwh: 28_800, risk_level: 'CRITICAL', claim_status: 'flagged', plant_name: 'Anantapur Solar', institution_name: 'Sunrise Textiles' },
  { case_id: 'INV-0003', claim_id: 'CLM-0005', plant_id: 'GEN-006', institution_id: 'INST-050', risk_score: 90, fraud_type: 'certificate_id_tampering', assigned_officer: 'Officer S. Kaur', status: 'open', opened_at: '2026-09-08T14:30:00+00:00', resolved_at: null, resolution_note: null, cert_id: 'REC-999', claimed_kwh: 821_300, expected_kwh: 820_700, actual_kwh: 821_300, risk_level: 'CRITICAL', claim_status: 'flagged', plant_name: 'Satara Ridge Wind', institution_name: 'Northwind Retail' },
  { case_id: 'INV-0004', claim_id: 'CLM-0013', plant_id: 'GEN-003', institution_id: 'INST-050', risk_score: 82, fraud_type: 'inflated_generation', assigned_officer: 'Officer D. Nair', status: 'awaiting_evidence', opened_at: '2026-09-05T11:00:00+00:00', resolved_at: null, resolution_note: 'Please provide meter logs and O&M reports for the period.', cert_id: 'REC-2006', claimed_kwh: 8_168_600, expected_kwh: 4_904_500, actual_kwh: 4_691_300, risk_level: 'CRITICAL', claim_status: 'evidence_requested', plant_name: 'Tirunelveli Wind Cluster', institution_name: 'Northwind Retail' },
];

export const auditEvents: AuditEvent[] = [
  'Claim submitted', 'Steganographic payload extracted', 'SHA-256 hash verified', 'RSA signature verified', 'Ledger lookup completed',
  'AI prediction generated', 'Fraud score calculated', 'Investigation opened',
].map((action, i) => ({
  id: i + 1, timestamp: `2026-09-11T10:${42 + Math.floor(i / 2)}:${(i % 2) * 30}0+00:00`.replace(/:(\d)0\+/, ':$10+'), actor: i === 0 ? 'INST-045' : i < 5 ? 'greenshield-crypto' : 'greenshield-ml',
  action, transaction_id: 'TXN-2026-0001', claim_id: 'CLM-0001', cert_id: 'REC-1022', reference_hash: i === 2 ? 'c9f0f895fb98ab9159f51fd0297e236d570bfa2c72a43571f1e5c68d96e9f2a3' : null,
  detail: i === 6 ? '92/100 CRITICAL — inflated_generation' : i === 5 ? 'expected 620,000 kWh (590,000–651,000); actual 605,000 kWh; model rf-v3-per-type' : null,
  prev_hash: i === 0 ? '0'.repeat(64) : `${i - 1}`.padStart(64, 'a'), entry_hash: `${i}`.padStart(64, 'b'),
}));

export const alerts: Alert[] = [
  { claim_id: 'CLM-0001', cert_id: 'REC-1022', plant_id: 'GEN-001', institution_id: 'INST-045', fraud_type: 'inflated_generation', risk_score: 92, risk_level: 'CRITICAL', text: 'GEN-001 reported 43.5% above expected generation (CLM-0001).', at: '2026-09-11T10:45:00+00:00' },
  { claim_id: 'CLM-0002', cert_id: 'REC-002', plant_id: 'GEN-009', institution_id: 'INST-018', fraud_type: 'tampered_certificate', risk_score: 90, risk_level: 'CRITICAL', text: 'REC-002 certificate payload mismatch detected (CLM-0002).', at: '2026-09-10T09:12:00+00:00' },
  { claim_id: 'CLM-0004', cert_id: 'REC-003', plant_id: 'GEN-009', institution_id: 'INST-042', fraud_type: 'duplicate_claim', risk_score: 90, risk_level: 'CRITICAL', text: 'REC-003 duplicate claim attempt blocked (CLM-0004).', at: '2026-09-09T16:20:00+00:00' },
  { claim_id: 'CLM-0005', cert_id: 'REC-999', plant_id: 'GEN-006', institution_id: 'INST-050', fraud_type: 'certificate_id_tampering', risk_score: 90, risk_level: 'CRITICAL', text: 'REC-999 certificate ID tampering detected (CLM-0005).', at: '2026-09-08T14:30:00+00:00' },
];

export const governmentDashboard: GovernmentDashboard = {
  kpis: { registered_plants: 12, registered_institutions: 12, active_claims: 29, verified_energy_kwh: 84_020_000, pending_verification: 7, suspicious_claims: 9, critical_risk: 6, certificates_issued: 28, open_investigations: 5 },
  verification_overview: { verified: 22, pending: 2, flagged: 5, rejected: 2 },
  comparison: {
    totals: { claimed_kwh: 112_400_000, expected_kwh: 104_950_000, actual_kwh: 105_200_000 },
    by_month: [
      { month: '2026-07', claimed_kwh: 52_100_000, expected_kwh: 49_800_000, actual_kwh: 50_100_000, claims: 15 },
      { month: '2026-08', claimed_kwh: 60_300_000, expected_kwh: 55_150_000, actual_kwh: 55_100_000, claims: 16 },
    ],
    top_claims: claims.slice(0, 6).map((c) => ({ claim_id: c.claim_id, plant_id: c.plant_id, institution_id: c.institution_id, claimed_kwh: c.claimed_kwh, expected_kwh: c.expected_kwh, actual_kwh: c.actual_kwh, risk_score: c.risk_score, risk_level: c.risk_level, status: c.status })),
  },
  risk_distribution: { LOW: 17, MEDIUM: 5, HIGH: 3, CRITICAL: 6 },
  recent_high_risk: claims.filter((c) => (c.risk_score ?? 0) > 60),
  alerts,
  investigations: { open: 3, critical: 3, awaiting_evidence: 1, resolved: 1, resolved_approved: 0, resolved_rejected: 1 },
  recent_audit: auditEvents.slice().reverse(),
  audit_chain: { valid: true, entries: 273, head: '7741bfb523bc825008c5b7fb6bf6d76faf6829a5513a9d8f3906d040e29ddafc' },
};

const days = (n: number, from = '2026-08-01') => Array.from({ length: n }, (_, i) => { const d = new Date(`${from}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });

export const plantProfile = (plant_id: string): PlantProfile => {
  const plant = plants.find((p) => p.plant_id === plant_id) ?? plants[0];
  const scale = plant.capacity_mw * 1000 * (plant.energy_type === 'Solar' ? 3.4 : plant.energy_type === 'Wind' ? 8 : 12);
  const series = days(60, '2026-07-14').map((date, i) => {
    const wave = 1 + 0.25 * Math.sin(i / 3.1) - 0.1 * Math.cos(i / 7);
    const predicted = Math.round(scale * wave);
    return { date, actual_kwh: Math.round(predicted * (1 + 0.05 * Math.sin(i * 1.7))), predicted_kwh: predicted, lower: Math.round(predicted * 0.92), upper: Math.round(predicted * 1.08), solar_irradiance_kwh_m2: 3.2 + Math.sin(i / 3.1), wind_speed_ms: 5 + 2 * Math.sin(i / 2), cloud_cover_pct: 55 + 20 * Math.cos(i / 4), temperature_c: 29 + 2 * Math.sin(i / 5) };
  });
  return {
    plant, kpis: { total_generation_kwh: plant.generation_kwh, avg_daily_kwh: plant.generation_kwh / 90, generation_days: 90, total_claims: plant.claims, flagged_claims: plant.flagged_claims, avg_risk: plant.avg_risk, capacity_factor_pct: 24.5 },
    series, monthly_generation: [{ month: '2026-06', kwh: plant.generation_kwh * 0.2, plants: 1 }, { month: '2026-07', kwh: plant.generation_kwh * 0.42, plants: 1 }, { month: '2026-08', kwh: plant.generation_kwh * 0.38, plants: 1 }],
    anomalies: claims.filter((c) => c.plant_id === plant_id && c.status !== 'verified'), claims: claims.filter((c) => c.plant_id === plant_id),
    weather: { temperature_c: 31.2, humidity_pct: 74, cloud_cover_pct: 58, solar_irradiance_kwh_m2: 3.6, wind_speed_ms: 6.1 },
  };
};

export const forecast = (plant_id: string): Forecast[] => {
  const plant = plants.find((p) => p.plant_id === plant_id) ?? plants[0];
  const base = plant.capacity_mw * 1000 * 3.6;
  return [24, 48, 72].map((h, i) => ({ horizon_hours: h, target_date: days(4, '2026-09-12')[i + 1], predicted_kwh: Math.round(base * [1.0, 1.04, 0.97][i]), lower_bound_kwh: Math.round(base * 0.94), upper_bound_kwh: Math.round(base * 1.08), weather: { temperature_c: 30, humidity_pct: 70, cloud_cover_pct: 50, solar_irradiance_kwh_m2: 3.8, wind_speed_ms: 5.5 } }));
};

export const generatorDashboard = (plant_id: string): GeneratorDashboard => {
  const profile = plantProfile(plant_id);
  const last = profile.series[profile.series.length - 1];
  return {
    plant: profile.plant,
    today: { date: last.date, generation_kwh: last.actual_kwh, expected: { predicted_kwh: last.predicted_kwh!, lower: last.lower!, upper: last.upper! }, deviation_pct: 2.8, status: 'NORMAL' },
    series_30d: profile.series.slice(-30), weather: profile.weather, forecast: forecast(plant_id), claims: profile.claims, stats: {},
  };
};

export const institutionDashboard = (institution_id: string): InstitutionDashboard => {
  const inst = institutions.find((i) => i.institution_id === institution_id) ?? institutions[0];
  const mine = claims.filter((c) => c.institution_id === institution_id);
  return {
    institution: inst,
    kpis: { total_purchased_energy_kwh: mine.reduce((s, c) => s + c.claimed_kwh, 0), verified_energy_kwh: mine.filter((c) => c.status === 'verified').reduce((s, c) => s + c.claimed_kwh, 0), pending_claims: mine.filter((c) => ['flagged', 'evidence_requested'].includes(c.status)).length, flagged_claims: mine.filter((c) => c.status === 'flagged').length, duplicate_attempts: mine.filter((c) => c.certificate_status === 'DUPLICATE').length, total_claims: mine.length },
    claims: mine,
    certificates: mine.map((c) => ({ claim_id: c.claim_id, cert_id: c.cert_id, generator: c.plant_id, plant_name: c.plant_name ?? null, energy_kwh: c.claimed_kwh, date: c.period_end, hash_status: c.certificate_status === 'TAMPERED' ? 'MISMATCH' : 'MATCH', signature_status: c.certificate_status === 'TAMPERED' ? 'INVALID' : 'VALID', ledger_status: c.status === 'verified' ? 'CLAIMED' : 'ISSUED', claimed_by: c.status === 'verified' ? c.institution_id : null, claim_status: c.status, final_status: c.certificate_status === 'DUPLICATE' ? 'DUPLICATE' : c.certificate_status === 'TAMPERED' || c.certificate_status === 'ID_TAMPERED' ? 'TAMPERED' : 'VALID', risk_score: c.risk_score, risk_level: c.risk_level })),
    transactions: mine.map((c) => ({ transaction_id: c.transaction_id!, cert_id: c.cert_id, seller_plant_id: c.plant_id, buyer_institution_id: c.institution_id, energy_kwh: c.claimed_kwh, price_inr: Math.round(c.claimed_kwh * 2.35), created_at: c.submitted_at })),
  };
};

export const certificates: CertificateListRow[] = claims.map((c) => ({
  cert_id: c.cert_id, generator_id: c.plant_id, source_type: c.energy_type ?? 'Solar', energy_kwh: c.actual_kwh ?? c.claimed_kwh, generation_date: c.period_end, issuer_id: 'ISSUER-NREC-01',
  data_hash: 'c9f0f895fb98ab9159f51fd0297e236d570bfa2c72a43571f1e5c68d96e9f2a3', status: c.status === 'verified' ? 'claimed' : 'issued', issued_at: '2026-09-01T09:00:00+00:00',
  claimed_by: c.status === 'verified' ? c.institution_id : null, claimed_at: c.status === 'verified' ? c.submitted_at : null, cert_file_path: null, plant_name: c.plant_name ?? null,
  security: c.certificate_security ?? null, claims: [{ cert_id: c.cert_id, claim_id: c.claim_id, institution_id: c.institution_id, status: c.status, risk_score: c.risk_score, risk_level: c.risk_level }],
  final_status: c.certificate_status === 'DUPLICATE' ? 'DUPLICATE' : c.certificate_status === 'TAMPERED' || c.certificate_status === 'ID_TAMPERED' ? 'TAMPERED' : c.certificate_status === 'NOT_FOUND' ? 'NOT FOUND' : c.status === 'verified' ? 'CLAIMED' : 'VALID',
}));

export const certificateDetail = (cert_id: string): CertificateDetail => {
  const row = certificates.find((c) => c.cert_id === cert_id) ?? certificates[0];
  const related = claims.filter((c) => c.cert_id === row.cert_id);
  return {
    cert_id: row.cert_id, ledger_record: { ...row }, plant: plants.find((p) => p.plant_id === row.generator_id) ?? null, security: row.security, claims: related,
    institution_id: related[0]?.institution_id ?? null,
    reconciliation: { status: (related[0]?.deviation_pct ?? 0) > 15 ? 'INCONSISTENT' : 'CONSISTENT', detail: 'Certified energy compared with AI expected and metered generation over 31 days.', plant_registered: true, window_days: 31, period_start: '2026-08-01', period_end: '2026-08-31', certified_kwh: row.energy_kwh, expected_kwh: related[0]?.expected_kwh ?? row.energy_kwh, actual_kwh: related[0]?.actual_kwh ?? row.energy_kwh, deviation_vs_expected_pct: related[0]?.deviation_pct ?? 0, tolerance_pct: 15 },
    checks: { hash: row.security?.hash_verified === 0 ? 'MISMATCH' : 'MATCH', rsa: row.security?.signature_verified === 0 ? 'INVALID' : 'VALID', steganography: 'VALID', ledger: 'REGISTERED', claim: row.status === 'claimed' ? 'CLAIMED' : 'NOT CLAIMED' },
    final_status: row.final_status, audit: auditEvents.filter((e) => e.cert_id === row.cert_id),
  };
};

export const claimDetail = (claim_id: string): ClaimDetailResponse => {
  const claim = claims.find((c) => c.claim_id === claim_id) ?? heroClaim;
  const profile = plantProfile(claim.plant_id);
  const inv = investigations.find((i) => i.claim_id === claim.claim_id);
  return {
    claim, audit: claim.claim_id === 'CLM-0001' ? auditEvents : auditEvents.slice(0, 5).map((e) => ({ ...e, claim_id: claim.claim_id, cert_id: claim.cert_id })),
    plant: profile.plant, institution: institutions.find((i) => i.institution_id === claim.institution_id) ?? null,
    evidence: { ai: claim.fraud_score ?? null, certificate: claim.certificate_security ?? null, ledger: claim.ledger_record ?? null, generation: profile.series.map((s) => ({ date: s.date, actual_kwh: s.actual_kwh })), predictions: profile.series.map((s) => ({ date: s.date, predicted_kwh: s.predicted_kwh!, lower: s.lower!, upper: s.upper! })), weather: profile.series.map((s) => ({ date: s.date, temperature_c: s.temperature_c ?? null, humidity_pct: 70, cloud_cover_pct: s.cloud_cover_pct ?? null, solar_irradiance_kwh_m2: s.solar_irradiance_kwh_m2 ?? null, wind_speed_ms: s.wind_speed_ms ?? null })), steg_payload: claim.ledger_record ? { cert_id: claim.cert_id, generator_id: claim.plant_id, energy_kwh: claim.ledger_record.energy_kwh, generation_date: claim.ledger_record.generation_date } : null },
    investigation: inv ? { ...inv, plant: profile.plant, institution: institutions.find((i) => i.institution_id === claim.institution_id) ?? null } : null,
  };
};

export const investigationDetail = (case_id: string): InvestigationDetail => {
  const inv = investigations.find((i) => i.case_id === case_id) ?? investigations[0];
  const detail = claimDetail(inv.claim_id);
  return { ...inv, claim: detail.claim, plant: detail.plant, institution: detail.institution, evidence: detail.evidence!, related_claims: { same_plant: claims.filter((c) => c.plant_id === inv.plant_id && c.claim_id !== inv.claim_id), same_institution: claims.filter((c) => c.institution_id === inv.institution_id && c.claim_id !== inv.claim_id) }, audit: detail.audit };
};

export const fraudNetwork: FraudNetwork = {
  nodes: [
    ...plants.map((p) => ({ id: p.plant_id, kind: 'plant' as const, label: p.name, energy_type: p.energy_type, capacity_mw: p.capacity_mw, claims: p.claims, flagged: p.flagged_claims, avg_risk: p.avg_risk, max_risk: p.max_risk, energy_kwh: p.generation_kwh })),
    ...institutions.map((i) => ({ id: i.institution_id, kind: 'institution' as const, label: i.name, sector: i.sector, claims: claims.filter((c) => c.institution_id === i.institution_id).length, flagged: claims.filter((c) => c.institution_id === i.institution_id && c.status !== 'verified').length, avg_risk: 40, max_risk: 92, energy_kwh: 1_000_000 })),
  ],
  edges: [
    { source: 'INST-045', target: 'GEN-001', claims: 2, flagged: 1, energy_kwh: 1_350_700, max_risk: 92, avg_risk: 47, certificates: ['REC-1022', 'REC-001'], fraud_types: ['inflated_generation'], relationship: 'Potentially Suspicious Relationship', suspicious: true },
    { source: 'INST-050', target: 'GEN-006', claims: 1, flagged: 1, energy_kwh: 821_300, max_risk: 90, avg_risk: 90, certificates: ['REC-999'], fraud_types: ['certificate_id_tampering'], relationship: 'Potentially Suspicious Relationship', suspicious: true },
    { source: 'INST-050', target: 'GEN-003', claims: 1, flagged: 1, energy_kwh: 8_168_600, max_risk: 82, avg_risk: 82, certificates: ['REC-2006'], fraud_types: ['inflated_generation'], relationship: 'Potentially Suspicious Relationship', suspicious: true },
    { source: 'INST-012', target: 'GEN-009', claims: 1, flagged: 0, energy_kwh: 948_300, max_risk: 3, avg_risk: 3, certificates: ['REC-003'], fraud_types: [], relationship: 'Normal Relationship', suspicious: false },
    { source: 'INST-042', target: 'GEN-009', claims: 1, flagged: 1, energy_kwh: 938_900, max_risk: 90, avg_risk: 90, certificates: ['REC-003'], fraud_types: ['duplicate_claim'], relationship: 'Potentially Suspicious Relationship', suspicious: true },
    { source: 'INST-018', target: 'GEN-009', claims: 1, flagged: 1, energy_kwh: 1000, max_risk: 90, avg_risk: 90, certificates: ['REC-002'], fraud_types: ['tampered_certificate'], relationship: 'Potentially Suspicious Relationship', suspicious: true },
    { source: 'INST-042', target: 'GEN-007', claims: 1, flagged: 0, energy_kwh: 9_322_600, max_risk: 6, avg_risk: 6, certificates: ['REC-2013'], fraud_types: [], relationship: 'Normal Relationship', suspicious: false },
    { source: 'INST-045', target: 'GEN-004', claims: 1, flagged: 0, energy_kwh: 11_351_300, max_risk: 38, avg_risk: 38, certificates: ['REC-2007'], fraud_types: [], relationship: 'Normal Relationship', suspicious: false },
  ],
  disclaimer: 'Relationships are statistical signals for review, not findings of collusion.',
};

export const analytics: Analytics = {
  filters: { date_from: null, date_to: null, energy_type: null, state: null },
  generation_by_month: [{ month: '2026-06', kwh: 28_900_000 }, { month: '2026-07', kwh: 52_600_000 }, { month: '2026-08', kwh: 49_100_000 }, { month: '2026-09', kwh: 6_800_000 }],
  claims_by_month: [{ month: '2026-07', claims: 15, claimed_kwh: 52_100_000, expected_kwh: 49_800_000, actual_kwh: 50_100_000, flagged: 3, rejected: 1 }, { month: '2026-08', claims: 16, claimed_kwh: 60_300_000, expected_kwh: 55_150_000, actual_kwh: 55_100_000, flagged: 4, rejected: 1 }],
  verified_energy_kwh: 84_020_000, rejected_energy_kwh: 5_938_900, fraud_detection_rate_pct: 29, avg_fraud_score: 31.4,
  risk_distribution: { LOW: 17, MEDIUM: 5, HIGH: 3, CRITICAL: 6 },
  deviation_distribution: [{ bucket: '< -20%', claims: 2 }, { bucket: '-20..0%', claims: 7 }, { bucket: '0..15%', claims: 12 }, { bucket: '15..40%', claims: 5 }, { bucket: '40..80%', claims: 4 }, { bucket: '> 80%', claims: 1 }],
  top_suspicious_generators: plants.slice().sort((a, b) => b.avg_risk - a.avg_risk).slice(0, 5).map((p) => ({ plant_id: p.plant_id, name: p.name, claims: p.claims, flagged: p.flagged_claims, max_risk: p.max_risk, claimed_kwh: p.generation_kwh, avg_risk: p.avg_risk })),
  top_suspicious_institutions: institutions.map((i, idx) => ({ institution_id: i.institution_id, name: i.name, claims: 3, flagged: [1, 1, 1, 1, 2][idx], max_risk: [92, 73, 90, 90, 90][idx], claimed_kwh: 2_000_000, avg_risk: [47, 38, 90, 48, 86][idx], duplicates: idx === 3 ? 1 : 0, tampering: idx === 2 || idx === 4 ? 1 : 0 })),
  certificate_tampering_attempts: 2, duplicate_claim_attempts: 1, total_claims: 31, states: ['Andhra Pradesh', 'Gujarat', 'Karnataka', 'Maharashtra', 'Rajasthan', 'Tamil Nadu', 'Uttarakhand'],
};

export const verifyValid: VerifyResult = {
  final_result: 'VALID', headline: 'VALID REC — authentic, registered, not claimed, generation consistent.', cert_id: 'REC-001',
  steps: [
    { step: 1, name: 'Steganographic Integrity', status: 'pass', detail: 'Hash integrity confirmed. Recomputed SHA-256 matches stored hash: c9f0f895fb98ab9159f51fd02…' },
    { step: 2, name: 'Signature Authentication', status: 'pass', detail: 'RSA-2048 signature is valid. Certificate was signed by a registered issuing authority.' },
    { step: 3, name: 'Ledger Lookup', status: 'pass', detail: "Certificate 'REC-001' is registered, valid, and not yet claimed." },
    { step: 4, name: 'Generation Reconciliation', status: 'pass', detail: 'Certified 460,700 kWh is within tolerance of AI expected (455,800 kWh) and metered (463,000 kWh) over 31 day(s) ending 2026-07-31.' },
  ],
  summary: { hash: 'MATCH', rsa: 'VALID', ledger: 'REGISTERED', claimed: 'NO', generation: 'CONSISTENT' }, certificate_status: 'VALID',
  extracted_data: { cert_id: 'REC-001', generator_id: 'GEN-001', energy_kwh: 460_700, generation_date: '2026-07-31', issuer_id: 'ISSUER-NREC-01' }, ledger_record: null,
  reconciliation: { status: 'CONSISTENT', detail: 'Within tolerance.', certified_kwh: 460_700, expected_kwh: 455_800, actual_kwh: 463_000, deviation_vs_expected_pct: 1.1, tolerance_pct: 15 }, original_record: null, file_sha256: 'ab'.repeat(32),
};

export const verifyTampered: VerifyResult = {
  final_result: 'TAMPERED', headline: 'FRAUD / TAMPERED — hash and/or signature do not verify.', cert_id: 'REC-002',
  steps: [
    { step: 1, name: 'Steganographic Integrity', status: 'fail', detail: 'HASH MISMATCH. Recomputed: a3b2c1d0e9f8…, Stored: c9f0f895fb98… The visible certificate data has been altered after issuance.' },
    { step: 2, name: 'Signature Authentication', status: 'pass', detail: 'RSA-2048 signature is valid for the original hash only.' },
    { step: 3, name: 'Ledger Lookup', status: 'skipped', detail: 'Skipped — Layer 1 failed (hash mismatch).' },
    { step: 4, name: 'Generation Reconciliation', status: 'skipped', detail: 'No trustworthy payload to reconcile.' },
  ],
  summary: { hash: 'MISMATCH', rsa: 'VALID', ledger: 'MISMATCH', claimed: 'NO', generation: 'SKIPPED' }, certificate_status: 'TAMPERED',
  extracted_data: { cert_id: 'REC-002', generator_id: 'GEN-009', energy_kwh: 1000, generation_date: '2026-08-10' }, ledger_record: null,
  reconciliation: { status: 'SKIPPED', detail: 'No trustworthy payload to reconcile.' }, original_record: null, file_sha256: 'cd'.repeat(32),
};

export const issueResult: IssueResult = {
  cert_id: 'REC-2031', hash: 'abc1230f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b', signature: 'VALID', ledger: 'REGISTERED', claim_status: 'NOT CLAIMED',
  file_name: 'REC-2031.png', download_url: '/api/certificate/REC-2031.png', preview_url: '/api/certificate/REC-2031.png/preview', issued_at: T0,
  steps: [
    { step: 'REC Input Data', status: 'done', detail: 'REC-2031 · GEN-001 · 18,400 kWh · 2026-09-11' },
    { step: 'SHA-256 Hash', status: 'done', detail: 'abc1230f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b' },
    { step: 'RSA Digital Signature', status: 'done', detail: 'MEUCIQCrGYe2aBx7kL2m…' },
    { step: 'Steganographic Embedding', status: 'done', detail: 'payload hidden in REC-2031.png (LSB)' },
    { step: 'Ledger Registration', status: 'done', detail: 'registered as issued, uid assigned' },
    { step: 'REC Issued', status: 'done', detail: T0 },
  ],
  anomaly_flag: false, anomaly_reason: null, payload: { cert_id: 'REC-2031', generator_id: 'GEN-001', energy_kwh: 18_400, generation_date: '2026-09-11' },
};

export const riskSettings = {
  thresholds: { LOW: 30, MEDIUM: 60, HIGH: 80 }, weights: { generation: 40, historical: 20, weather: 20, certificate: 10, capacity: 10 }, auto_verify_max_level: 'MEDIUM' as const,
  updated_at: null, updated_by: null, model: { version: 'rf-v3-per-type', trained_at: T0, metrics: { r2: 0.9956, mape_pct: 3.5 } },
};

export const sessions: Record<string, Session> = {
  government: { access_token: 'mock-gov', expires_in: 3600, user: { email: 'gov@greenshield.gov', role: 'government', organisation: 'Ministry of New & Renewable Energy', entity_id: null, display_name: 'Verification Officer' } },
  generator: { access_token: 'mock-gen', expires_in: 3600, user: { email: 'ops@gen-001.in', role: 'generator', organisation: 'Kutch Solar Park A', entity_id: 'GEN-001', display_name: 'Plant Operations, GEN-001' } },
  institution: { access_token: 'mock-inst', expires_in: 3600, user: { email: 'claims@inst-045.org', role: 'institution', organisation: 'Acme Steel Ltd', entity_id: 'INST-045', display_name: 'Sustainability Lead, Acme Steel' } },
  issuer: { access_token: 'mock-iss', expires_in: 3600, user: { email: 'issuer@greenshield.gov', role: 'issuer', organisation: 'National REC Registry', entity_id: null, display_name: 'REC Issuing Officer' } },
};

/** Route a mocked request (method + path + body) to sample data. Throws for unknown paths. */
export function route(method: string, path: string, body?: unknown): unknown {
  const p = path.replace(/^\/api/, '').split('?')[0];
  const m = method.toUpperCase();
  const seg = p.split('/').filter(Boolean);
  if (m === 'POST' && p === '/auth/login') return sessions[(body as { role?: string })?.role ?? 'government'] ?? sessions.government;
  if (m === 'POST' && seg[0] === 'auth' && seg[1] === 'demo') return sessions[seg[2]] ?? sessions.government;
  if (p === '/auth/me') return sessions.government.user;
  if (p === '/dashboard/government' || p === '/dashboard/me') return governmentDashboard;
  if (seg[0] === 'dashboard' && seg[1] === 'generator') return generatorDashboard(seg[2]);
  if (seg[0] === 'dashboard' && seg[1] === 'institution') return institutionDashboard(seg[2]);
  if (p === '/analytics/government') return analytics;
  if (p === '/claims' && m === 'GET') return { claims, total: claims.length, limit: 50, offset: 0 };
  if (p === '/claims' && m === 'POST') return { claim: { ...heroClaim, claim_id: 'CLM-0032', status: 'verified', risk_score: 4, risk_level: 'LOW', fraud_type: 'none', case_id: null } };
  if (seg[0] === 'claims' && seg[2] === 'decision') return { claim: { ...claims.find((c) => c.claim_id === seg[1])!, status: (body as { decision: string }).decision === 'approve' ? 'approved' : (body as { decision: string }).decision === 'reject' ? 'rejected' : 'evidence_requested' } };
  if (seg[0] === 'claims' && seg[2] === 'audit') return { claim_id: seg[1], events: auditEvents };
  if (seg[0] === 'claims' && seg[1]) return claimDetail(seg[1]);
  if (p === '/investigations') return { cases: investigations, stats: governmentDashboard.investigations };
  if (seg[0] === 'investigations' && seg[2] === 'decision') return { claim: claims[0], case: investigationDetail(seg[1]) };
  if (seg[0] === 'investigations' && seg[1]) return { case: investigationDetail(seg[1]) };
  if (p === '/plants') return { plants, count: plants.length };
  if (seg[0] === 'plants' && seg[1]) return plantProfile(seg[1]);
  if (p === '/institutions') return { institutions, count: institutions.length };
  if (seg[0] === 'institutions' && seg[1]) return institutionDashboard(seg[1]);
  if (p === '/fraud/network') return fraudNetwork;
  if (seg[0] === 'fraud' && seg[1] === 'network') return { kind: seg[2], entity: plants[0], claims: 4, total_energy_kwh: 1_350_700, flagged_claims: 2, certificates: ['REC-1022', 'REC-001'], counterparties: ['INST-045', 'INST-012'], avg_risk: 40, risk_history: claims.slice(0, 3).map((c) => ({ claim_id: c.claim_id, at: c.submitted_at, risk_score: c.risk_score, risk_level: c.risk_level, status: c.status })) };
  if (p === '/fraud/alerts') return { alerts };
  if (p === '/fraud/analyze') return { plant: plants[0], ai: { expected_kwh: 620_000 }, actual_kwh: 605_000, risk: heroClaim.fraud_score };
  if (p === '/certificates') return { certificates, count: certificates.length };
  if (seg[0] === 'certificates' && seg[2] === 'verify') return { cert_id: seg[1], status: 'VALID', reason: 'ok', checks: { steganography: true, hash: true, signature: true, ledger: true, claim_state: true }, final_status: 'VALID' };
  if (seg[0] === 'certificates' && seg[1]) return certificateDetail(seg[1]);
  if (p === '/audit') return { events: auditEvents.slice().reverse(), count: auditEvents.length, chain: governmentDashboard.audit_chain };
  if (p === '/audit/verify') return governmentDashboard.audit_chain;
  if (seg[0] === 'audit' && seg[1]) return { reference: seg[1], events: auditEvents };
  if (seg[0] === 'generation' && seg[1] === 'upload') return { plant_id: 'GEN-001', rows: 3, first_date: '2026-09-09', last_date: '2026-09-11', stats: {} };
  if (p === '/generation' && m === 'POST') return { plant_id: (body as { plant_id: string }).plant_id, rows: 1, first_date: '2026-09-11', last_date: '2026-09-11', stats: {} };
  if (seg[0] === 'generation' && seg[1]) return { plant_id: seg[1], rows: plantProfile(seg[1]).series.slice(-30).map((s, i) => ({ id: i, plant_id: seg[1], date: s.date, hour: null, generation_kwh: s.actual_kwh ?? 0, meter_reading_kwh: 1_200_000 + i * 18_000, operating_hours: 11.5, source: 'meter', submitted_by: 'ops@gen-001.in', submitted_at: s.date, predicted_kwh: s.predicted_kwh })), count: 30, stats: {}, monthly: plantProfile(seg[1]).monthly_generation };
  if (seg[0] === 'prediction' && seg[1] === 'forecast') return { plant_id: seg[2], forecast: forecast(seg[2]) };
  if (p === '/prediction/generation') return { prediction: { plant_id: 'GEN-001', period_start: '2026-08-01', period_end: '2026-08-31', days: 31, expected_kwh: 620_000, lower_bound_kwh: 590_000, upper_bound_kwh: 651_000, historical_expected_kwh: 600_000, capacity_max_kwh: 3_720_000, weather_avg: { temperature_c: 30, humidity_pct: 72, cloud_cover_pct: 60, solar_irradiance_kwh_m2: 3.4, wind_speed_ms: 5 }, model_version: 'rf-v3-per-type', daily: [], actual_kwh: 605_000 } };
  if (p === '/rec/issue') return issueResult;
  if (p === '/rec/verify') return verifyValid;
  if (p === '/settings/risk' && m === 'GET') return riskSettings;
  if (p === '/settings/risk' && m === 'PUT') return { ...riskSettings, ...(body as object), updated_by: 'gov@greenshield.gov', updated_at: T0 };
  if (p === '/settings/risk/reset') return riskSettings;
  if (p === '/ml/model') return { model: { version: 'rf-v3-per-type', algorithm: 'RandomForestRegressor (one forest per energy type)', metrics: { r2: 0.9956, mape_pct: 3.5 } } };
  throw new Error(`Mock API has no handler for ${m} ${p}`);
}
