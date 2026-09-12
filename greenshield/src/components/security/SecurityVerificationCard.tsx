import { ShieldCheck, ShieldX, ShieldAlert } from 'lucide-react';
import type { CertificateSecurity, CertificateStatus, SecurityChecks } from '@/types';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ClaimStatus, HashStatus, LedgerStatus, RsaStatus, StegStatus } from './StatusIndicators';
import { cn } from '@/lib/cn';

const FINAL: Record<string, { label: string; tone: 'low' | 'critical' | 'high' | 'medium' }> = {
  VALID: { label: 'AUTHENTIC CERTIFICATE', tone: 'low' }, NOT_PROVIDED: { label: 'LEDGER CHECK ONLY', tone: 'medium' }, TAMPERED: { label: 'TAMPERED CERTIFICATE', tone: 'critical' },
  ID_TAMPERED: { label: 'CERTIFICATE ID TAMPERING DETECTED', tone: 'critical' }, DUPLICATE: { label: 'ALREADY CLAIMED — DUPLICATE', tone: 'critical' }, NOT_FOUND: { label: 'NOT REGISTERED', tone: 'high' }, REVOKED: { label: 'REVOKED', tone: 'high' },
};

export function checksFromSecurity(sec: CertificateSecurity | null | undefined): SecurityChecks | null {
  if (!sec) return null;
  const b = (v: number | null) => (v === null || v === undefined ? null : v === 1);
  return { steganography: b(sec.steg_verified), hash: b(sec.hash_verified), signature: b(sec.signature_verified), ledger: b(sec.ledger_verified), claim_state: b(sec.claim_verified) };
}

/** FinalMD §18/§43 — the vertical REC security chain with a verdict. */
export function SecurityVerificationCard({ checks, result, claimedBy, reason, title = 'REC Security Verification', compact }: { checks: SecurityChecks | null; result: CertificateStatus | string | null | undefined; claimedBy?: string | null; reason?: string | null; title?: string; compact?: boolean }) {
  const final = FINAL[result ?? ''] ?? { label: result ?? 'NOT VERIFIED', tone: 'medium' as const };
  const Icon = final.tone === 'low' ? ShieldCheck : final.tone === 'critical' ? ShieldX : ShieldAlert;
  const toneCls = { low: 'bg-low-soft text-low', critical: 'bg-critical-soft text-critical', high: 'bg-high-soft text-high', medium: 'bg-medium-soft text-medium' }[final.tone];
  const body = (
    <>
      <div className="divide-y divide-line">
        <StegStatus ok={checks?.steganography} />
        <HashStatus ok={checks?.hash} />
        <RsaStatus ok={checks?.signature} />
        <LedgerStatus ok={checks?.ledger} text={result === 'NOT_FOUND' ? { fail: 'NOT FOUND' } : undefined} />
        <ClaimStatus ok={checks?.claim_state} claimedBy={claimedBy} />
      </div>
      <div className={cn('mt-4 flex items-center gap-3 rounded-lg px-4 py-3', toneCls)}>
        <Icon size={22} />
        <div><div className="text-sm font-bold tracking-wide">{final.label}</div>{reason && <div className="text-xs opacity-80">{reason}</div>}</div>
        <StatusBadge status={result} kind="certificate" className="ml-auto" />
      </div>
    </>
  );
  return compact ? body : <Panel title={title} subtitle="Steganography → SHA-256 → RSA signature → ledger → claim state">{body}</Panel>;
}
