import type { RiskLevel, ClaimStatus, CertificateStatus } from '@/types';

export const RISK_ORDER: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function riskTone(level: RiskLevel | null | undefined): 'low' | 'medium' | 'high' | 'critical' | 'info' {
  switch (level) {
    case 'LOW': return 'low';
    case 'MEDIUM': return 'medium';
    case 'HIGH': return 'high';
    case 'CRITICAL': return 'critical';
    default: return 'info';
  }
}

export function levelForScore(score: number, thresholds = { LOW: 30, MEDIUM: 60, HIGH: 80 }): RiskLevel {
  if (score <= thresholds.LOW) return 'LOW';
  if (score <= thresholds.MEDIUM) return 'MEDIUM';
  if (score <= thresholds.HIGH) return 'HIGH';
  return 'CRITICAL';
}

export function claimStatusTone(status: ClaimStatus | string | null | undefined): 'low' | 'medium' | 'high' | 'critical' | 'info' | 'neutral' {
  switch (status) {
    case 'verified':
    case 'approved': return 'low';
    case 'flagged': return 'high';
    case 'rejected': return 'critical';
    case 'evidence_requested':
    case 'submitted':
    case 'verifying': return 'medium';
    default: return 'neutral';
  }
}

export function certStatusTone(status: CertificateStatus | string | null | undefined): 'low' | 'medium' | 'high' | 'critical' | 'info' | 'neutral' {
  switch (status) {
    case 'VALID':
    case 'CLAIMED': return 'low';
    case 'NOT_PROVIDED': return 'medium';
    case 'NOT_FOUND':
    case 'NOT FOUND':
    case 'REVOKED': return 'high';
    case 'TAMPERED':
    case 'ID_TAMPERED':
    case 'DUPLICATE': return 'critical';
    default: return 'neutral';
  }
}

export const FRAUD_TYPE_LABEL: Record<string, string> = {
  none: 'No fraud indicators',
  inflated_generation: 'Inflated generation',
  tampered_certificate: 'Tampered certificate',
  certificate_id_tampering: 'Certificate ID tampering',
  duplicate_claim: 'Duplicate claim',
  unregistered_certificate: 'Unregistered certificate',
  revoked_certificate: 'Revoked certificate',
};
