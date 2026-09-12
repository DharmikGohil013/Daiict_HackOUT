/** Shapes mirror backend/routes/*.py + backend/modules/*.py — the API is the source of truth. */

export type Role = 'government' | 'generator' | 'institution' | 'issuer' | 'regulator' | 'buyer' | 'auditor' | 'admin';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ClaimStatus = 'submitted' | 'verifying' | 'verified' | 'flagged' | 'evidence_requested' | 'approved' | 'rejected';
export type CertificateStatus = 'VALID' | 'NOT_PROVIDED' | 'NOT_FOUND' | 'DUPLICATE' | 'REVOKED' | 'TAMPERED' | 'ID_TAMPERED';
export type FraudType = 'none' | 'inflated_generation' | 'tampered_certificate' | 'certificate_id_tampering' | 'duplicate_claim' | 'unregistered_certificate' | 'revoked_certificate';
export type EnergyType = 'Solar' | 'Wind' | 'Hydro' | 'Biomass' | 'Geothermal' | 'Tidal' | 'Other';
export type InvestigationStatus = 'open' | 'awaiting_evidence' | 'resolved_approved' | 'resolved_rejected';
export type Decision = 'approve' | 'reject' | 'request_evidence';

export interface User {
  user_id?: number;
  email: string;
  role: Role;
  organisation?: string | null;
  entity_id?: string | null;
  display_name?: string | null;
  created_at?: string;
}

export interface Session {
  access_token: string;
  expires_in: number;
  user: User;
}

export interface Plant {
  plant_id: string;
  name: string;
  energy_type: EnergyType | string;
  capacity_mw: number;
  location: string;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  operator_email?: string | null;
  registered_at: string;
  status: 'active' | 'under_review' | 'suspended';
}

export interface PlantWithStats extends Plant {
  generation_kwh: number;
  generation_days: number;
  claims: number;
  flagged_claims: number;
  avg_risk: number;
  max_risk: number;
}

export interface Institution {
  institution_id: string;
  name: string;
  sector?: string | null;
  location?: string | null;
  contact_email?: string | null;
  registered_at: string;
  status: string;
}

export interface Finding { severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'OK'; text: string; }

export interface FraudScore {
  total: number;
  level: RiskLevel;
  components: { generation: number; historical: number; weather: number; certificate: number; capacity: number };
  weights?: { generation: number; historical: number; weather: number; certificate: number; capacity: number };
  thresholds?: { LOW: number; MEDIUM: number; HIGH: number };
  findings: Finding[];
  checks: string[];
  metrics: {
    claimed_kwh: number;
    expected_kwh: number | null;
    actual_kwh: number | null;
    historical_expected_kwh: number | null;
    deviation_vs_expected_pct: number | null;
    deviation_vs_historical_pct: number | null;
    deviation_vs_actual_pct: number | null;
    capacity_max_kwh: number;
    certificate_status: string;
  };
  certificate?: { status: CertificateStatus; reason: string; checks: SecurityChecks };
}

export interface SecurityChecks {
  steganography: boolean | null;
  hash: boolean | null;
  signature: boolean | null;
  ledger: boolean | null;
  claim_state: boolean | null;
}

export interface CertificateSecurity {
  cert_id: string;
  sha256_hash: string | null;
  rsa_signature: string | null;
  steg_payload_json: string | null;
  steg_verified: number | null;
  hash_verified: number | null;
  signature_verified: number | null;
  ledger_verified: number | null;
  claim_verified: number | null;
  last_result: CertificateStatus | string | null;
  verified_at: string | null;
}

export interface LedgerRecord {
  uid?: string;
  cert_id: string;
  generator_id: string;
  source_type: string;
  energy_kwh: number;
  generation_date: string;
  issuer_id: string;
  data_hash: string;
  signature?: string;
  status: 'issued' | 'claimed' | 'revoked';
  issued_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
  cert_file_path: string | null;
}

export interface Claim {
  claim_id: string;
  cert_id: string;
  plant_id: string;
  institution_id: string;
  transaction_id: string | null;
  period_start: string;
  period_end: string;
  claimed_kwh: number;
  expected_kwh: number | null;
  expected_lower_kwh: number | null;
  expected_upper_kwh: number | null;
  actual_kwh: number | null;
  deviation_pct: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  certificate_status: CertificateStatus | null;
  fraud_type: FraudType | null;
  status: ClaimStatus;
  decision: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  certificate_file_path: string | null;
  submitted_by: string | null;
  submitted_at: string;
  updated_at: string;
  plant_name?: string | null;
  energy_type?: string | null;
  capacity_mw?: number | null;
  plant_location?: string | null;
  plant_state?: string | null;
  institution_name?: string | null;
  institution_sector?: string | null;
  case_id?: string | null;
  investigation_status?: InvestigationStatus | null;
  fraud_score?: FraudScore | null;
  certificate_security?: CertificateSecurity | null;
  ledger_record?: LedgerRecord | null;
}

export interface ClaimList { claims: Claim[]; total: number; limit: number; offset: number; }

export interface AuditEvent {
  id: number;
  timestamp: string;
  actor: string | null;
  action: string;
  transaction_id: string | null;
  claim_id: string | null;
  cert_id: string | null;
  reference_hash: string | null;
  detail: string | null;
  prev_hash: string;
  entry_hash: string;
}

export interface AuditChain { valid: boolean; entries: number; head?: string; broken_at_id?: number; }

export interface GenerationPoint { date: string; actual_kwh: number | null; source?: string; }
export interface PredictionPoint { date: string; predicted_kwh: number; lower: number; upper: number; }
export interface WeatherDay {
  date?: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  cloud_cover_pct: number | null;
  solar_irradiance_kwh_m2: number | null;
  wind_speed_ms: number | null;
}

export interface Evidence {
  ai: FraudScore | null;
  certificate: CertificateSecurity | null;
  ledger: LedgerRecord | null;
  generation: GenerationPoint[];
  predictions: PredictionPoint[];
  weather: WeatherDay[];
  steg_payload: Record<string, unknown> | null;
}

export interface Investigation {
  case_id: string;
  claim_id: string;
  plant_id: string | null;
  institution_id: string | null;
  risk_score: number | null;
  fraud_type: FraudType | string | null;
  assigned_officer: string | null;
  status: InvestigationStatus;
  opened_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  cert_id?: string;
  claimed_kwh?: number;
  expected_kwh?: number | null;
  actual_kwh?: number | null;
  risk_level?: RiskLevel | null;
  claim_status?: ClaimStatus;
  plant_name?: string | null;
  institution_name?: string | null;
}

export interface InvestigationDetail extends Investigation {
  claim: Claim | null;
  plant: Plant | null;
  institution: Institution | null;
  evidence: Evidence;
  related_claims: { same_plant: Claim[]; same_institution: Claim[] };
  audit: AuditEvent[];
}

export interface InvestigationStats { open: number; critical: number; awaiting_evidence: number; resolved: number; resolved_approved: number; resolved_rejected: number; }

export interface ClaimDetailResponse {
  claim: Claim;
  audit: AuditEvent[];
  plant: Plant | null;
  institution: Institution | null;
  evidence: Evidence | null;
  investigation: Omit<InvestigationDetail, 'evidence' | 'claim' | 'audit' | 'related_claims'> | null;
}

export interface Alert {
  claim_id: string;
  cert_id: string;
  plant_id: string;
  institution_id: string;
  fraud_type: FraudType;
  risk_score: number;
  risk_level: RiskLevel;
  text: string;
  at: string;
}

export interface GovernmentDashboard {
  kpis: {
    registered_plants: number;
    registered_institutions: number;
    active_claims: number;
    verified_energy_kwh: number;
    pending_verification: number;
    suspicious_claims: number;
    critical_risk: number;
    certificates_issued: number;
    open_investigations: number;
  };
  verification_overview: { verified: number; pending: number; flagged: number; rejected: number };
  comparison: {
    totals: { claimed_kwh: number; expected_kwh: number; actual_kwh: number };
    by_month: Array<{ month: string; claimed_kwh: number; expected_kwh: number; actual_kwh: number; claims: number }>;
    top_claims: Array<Pick<Claim, 'claim_id' | 'plant_id' | 'institution_id' | 'claimed_kwh' | 'expected_kwh' | 'actual_kwh' | 'risk_score' | 'risk_level' | 'status'>>;
  };
  risk_distribution: Record<RiskLevel, number>;
  recent_high_risk: Claim[];
  alerts: Alert[];
  investigations: InvestigationStats;
  recent_audit: AuditEvent[];
  audit_chain: AuditChain;
}

export interface PlantProfile {
  plant: Plant;
  kpis: { total_generation_kwh: number; avg_daily_kwh: number; generation_days: number; total_claims: number; flagged_claims: number; avg_risk: number; capacity_factor_pct: number | null };
  series: Array<{ date: string; actual_kwh: number | null; predicted_kwh: number | null; lower: number | null; upper: number | null } & Partial<WeatherDay>>;
  monthly_generation: Array<{ month: string; kwh: number; plants: number }>;
  anomalies: Claim[];
  claims: Claim[];
  weather: WeatherDay | null;
}

export interface Forecast {
  horizon_hours: number;
  target_date: string;
  predicted_kwh: number;
  lower_bound_kwh: number;
  upper_bound_kwh: number;
  weather: WeatherDay;
}

export interface GeneratorDashboard {
  plant: Plant;
  today: { date: string | null; generation_kwh: number | null; expected: { predicted_kwh: number; lower: number; upper: number } | null; deviation_pct: number | null; status: 'NORMAL' | 'WATCH' | 'ANOMALY' | 'NO DATA' };
  series_30d: PlantProfile['series'];
  weather: WeatherDay | null;
  forecast: Forecast[];
  claims: Claim[];
  stats: Record<string, unknown>;
}

export interface GenerationRow {
  id?: number;
  plant_id: string;
  date: string;
  hour: number | null;
  generation_kwh: number;
  meter_reading_kwh: number | null;
  operating_hours: number | null;
  source: 'meter' | 'manual' | 'csv' | 'seed';
  submitted_by: string | null;
  submitted_at: string;
  predicted_kwh?: number | null;
}

export interface Prediction {
  plant_id: string;
  period_start: string;
  period_end: string;
  days: number;
  expected_kwh: number;
  lower_bound_kwh: number;
  upper_bound_kwh: number;
  historical_expected_kwh: number;
  capacity_max_kwh: number;
  weather_avg: WeatherDay;
  model_version: string;
  daily: PredictionPoint[];
  actual_kwh?: number | null;
}

export interface InstitutionCertificateRow {
  claim_id: string;
  cert_id: string;
  generator: string;
  plant_name: string | null;
  energy_kwh: number;
  date: string;
  hash_status: 'MATCH' | 'MISMATCH' | 'NOT CHECKED';
  signature_status: 'VALID' | 'INVALID' | 'NOT CHECKED';
  ledger_status: string;
  claimed_by: string | null;
  claim_status: ClaimStatus;
  final_status: 'VALID' | 'TAMPERED' | 'DUPLICATE' | 'NOT FOUND' | 'REVOKED';
  risk_score: number | null;
  risk_level: RiskLevel | null;
}

export interface Transaction {
  transaction_id: string;
  cert_id: string | null;
  seller_plant_id: string | null;
  buyer_institution_id: string | null;
  energy_kwh: number | null;
  price_inr: number | null;
  created_at: string;
}

export interface InstitutionDashboard {
  institution: Institution;
  kpis: { total_purchased_energy_kwh: number; verified_energy_kwh: number; pending_claims: number; flagged_claims: number; duplicate_attempts: number; total_claims: number };
  claims: Claim[];
  certificates: InstitutionCertificateRow[];
  transactions: Transaction[];
}

export interface CertificateListRow extends Omit<LedgerRecord, 'signature'> {
  plant_name: string | null;
  security: CertificateSecurity | null;
  claims: Array<{ cert_id: string; claim_id: string; institution_id: string; status: ClaimStatus; risk_score: number | null; risk_level: RiskLevel | null }>;
  final_status: 'VALID' | 'CLAIMED' | 'TAMPERED' | 'DUPLICATE' | 'NOT FOUND' | 'REVOKED';
}

export interface Reconciliation {
  status: 'CONSISTENT' | 'INCONSISTENT' | 'UNKNOWN' | 'SKIPPED';
  detail: string;
  plant_registered?: boolean;
  plant?: { plant_id: string; name: string; energy_type: string; capacity_mw: number };
  window_days?: number;
  period_start?: string;
  period_end?: string;
  certified_kwh?: number;
  expected_kwh?: number;
  expected_lower_kwh?: number;
  expected_upper_kwh?: number;
  actual_kwh?: number | null;
  deviation_vs_expected_pct?: number;
  deviation_vs_actual_pct?: number | null;
  tolerance_pct?: number;
}

export interface CertificateDetail {
  cert_id: string;
  ledger_record: Omit<LedgerRecord, 'signature'> | null;
  plant: Plant | null;
  security: CertificateSecurity | null;
  claims: Claim[];
  institution_id: string | null;
  reconciliation: Reconciliation | null;
  checks: { hash: string; rsa: string; steganography: string; ledger: string; claim: string };
  final_status: CertificateListRow['final_status'];
  audit: AuditEvent[];
}

export interface VerifyStep { step: number; name: string; status: 'pass' | 'fail' | 'skipped'; detail: string; }

export interface VerifyResult {
  final_result: 'VALID' | 'TAMPERED' | 'DUPLICATE' | 'NOT FOUND' | 'REVOKED' | 'INCONSISTENT';
  headline: string;
  cert_id: string | null;
  steps: VerifyStep[];
  summary: { hash: string; rsa: string; ledger: string; claimed: string; generation: string };
  certificate_status: CertificateStatus;
  extracted_data: Record<string, unknown> | null;
  ledger_record: LedgerRecord | null;
  reconciliation: Reconciliation;
  original_record: LedgerRecord | null;
  file_sha256: string | null;
}

export interface IssueStep { step: string; status: 'done' | 'pending' | 'error'; detail: string; }

export interface IssueResult {
  cert_id: string;
  hash: string;
  signature: string;
  ledger: string;
  claim_status: string;
  file_name: string;
  download_url: string;
  preview_url: string;
  issued_at: string;
  steps: IssueStep[];
  anomaly_flag?: boolean;
  anomaly_reason?: string | null;
  payload: Record<string, unknown>;
}

export interface NetworkNode {
  id: string;
  kind: 'plant' | 'institution';
  label: string;
  energy_type?: string;
  capacity_mw?: number;
  sector?: string | null;
  claims: number;
  flagged: number;
  avg_risk: number;
  max_risk: number;
  energy_kwh: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  claims: number;
  flagged: number;
  energy_kwh: number;
  max_risk: number;
  avg_risk: number;
  certificates: string[];
  fraud_types: string[];
  relationship: string;
  suspicious: boolean;
}

export interface FraudNetwork { nodes: NetworkNode[]; edges: NetworkEdge[]; disclaimer: string; }

export interface EntityProfile {
  kind: 'plant' | 'institution';
  entity: Plant | Institution;
  claims: number;
  total_energy_kwh: number;
  flagged_claims: number;
  certificates: string[];
  counterparties: string[];
  avg_risk: number;
  risk_history: Array<{ claim_id: string; at: string; risk_score: number | null; risk_level: RiskLevel | null; status: ClaimStatus }>;
}

export interface Analytics {
  filters: { date_from: string | null; date_to: string | null; energy_type: string | null; state: string | null };
  generation_by_month: Array<{ month: string; kwh: number }>;
  claims_by_month: Array<{ month: string; claims: number; claimed_kwh: number; expected_kwh: number; actual_kwh: number; flagged: number; rejected: number }>;
  verified_energy_kwh: number;
  rejected_energy_kwh: number;
  fraud_detection_rate_pct: number;
  avg_fraud_score: number;
  risk_distribution: Record<RiskLevel, number>;
  deviation_distribution: Array<{ bucket: string; claims: number }>;
  top_suspicious_generators: Array<{ plant_id: string; name: string; claims: number; flagged: number; max_risk: number; claimed_kwh: number; avg_risk: number }>;
  top_suspicious_institutions: Array<{ institution_id: string; name: string; claims: number; flagged: number; max_risk: number; claimed_kwh: number; avg_risk: number; duplicates: number; tampering: number }>;
  certificate_tampering_attempts: number;
  duplicate_claim_attempts: number;
  total_claims: number;
  states: string[];
}

export interface ApiError extends Error { status?: number; details?: string[]; }
