import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Circle, XCircle, Clock } from 'lucide-react';
import { useClaim } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { Kv } from '@/components/common/Kv';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RiskBadge } from '@/components/common/RiskBadge';
import { ErrorState, LoadingState } from '@/components/common/States';
import { EnergyComparisonCard } from '@/components/claims/EnergyComparisonCard';
import { SecurityVerificationCard, checksFromSecurity } from '@/components/security/SecurityVerificationCard';
import { fmtDate, fmtDateTime, fmtEnergy } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/cn';

const STEPS = ['Claim Submitted', 'Certificate Validation', 'Steganographic Verification', 'Hash Verification', 'RSA Signature Verification', 'Ledger Lookup', 'AI Generation Verification', 'Fraud Analysis', 'Government Review', 'Final Decision'];

export default function ClaimStatusPage() {
  const { id } = useParams();
  const q = useClaim(id);
  if (q.isLoading) return <LoadingState label="Loading claim…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { claim, audit } = q.data;
  const done = (step: string) => {
    if (['Government Review', 'Final Decision'].includes(step)) return ['approved', 'rejected'].includes(claim.status) || (step === 'Government Review' && claim.status === 'evidence_requested');
    if (step === 'Fraud Analysis') return claim.risk_score != null;
    if (step === 'AI Generation Verification') return claim.expected_kwh != null;
    if (step.includes('Steganographic') || step.includes('Hash') || step.includes('RSA')) return audit.some((e) => (step.includes('Steganographic') && /Steganographic/.test(e.action)) || (step.includes('Hash') && /SHA-256/.test(e.action)) || (step.includes('RSA') && /RSA/.test(e.action)));
    return true;
  };
  const failed = (step: string) => (step === 'Final Decision' && claim.status === 'rejected') || (step.includes('Hash') && ['TAMPERED', 'ID_TAMPERED'].includes(claim.certificate_status ?? '') && audit.some((e) => /MISMATCH/.test(e.action))) || (step === 'Ledger Lookup' && ['DUPLICATE', 'NOT_FOUND'].includes(claim.certificate_status ?? ''));
  return (
    <>
      <PageHeader eyebrow={<Link to={ROUTES.institution.claims}>← My claims</Link>} title={<>Claim <span className="font-mono">{claim.claim_id}</span></>} subtitle={`${claim.cert_id} · ${claim.plant_name ?? claim.plant_id} · ${fmtDate(claim.period_start)} – ${fmtDate(claim.period_end)}`} actions={<><StatusBadge status={claim.status} kind="claim" /><RiskBadge score={claim.risk_score} level={claim.risk_level} /></>} />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Panel title="Verification timeline">
          <ol className="space-y-2">{STEPS.map((s) => { const ok = done(s), bad = failed(s); return <li key={s} className={cn('flex items-center gap-2 text-sm', ok ? 'text-ink' : 'text-ink-3')}>{bad ? <XCircle size={16} className="text-critical" /> : ok ? <CheckCircle2 size={16} className="text-low" /> : s === 'Government Review' && claim.status === 'flagged' ? <Clock size={16} className="text-medium" /> : <Circle size={16} />}{s}</li>; })}</ol>
        </Panel>
        <div className="space-y-4">
          <Panel><Kv cols={4} items={[{ label: 'Claimed', value: fmtEnergy(claim.claimed_kwh) }, { label: 'AI expected', value: fmtEnergy(claim.expected_kwh) }, { label: 'Actual', value: fmtEnergy(claim.actual_kwh) }, { label: 'Certificate', value: <StatusBadge status={claim.certificate_status} kind="certificate" /> }, { label: 'Submitted', value: fmtDateTime(claim.submitted_at) }, { label: 'Updated', value: fmtDateTime(claim.updated_at) }, { label: 'Decision', value: claim.decision ?? 'Pending' }, { label: 'Note', value: claim.decision_note ?? '—' }]} /></Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <EnergyComparisonCard claimed={claim.claimed_kwh} expected={claim.expected_kwh} actual={claim.actual_kwh} range={{ lower: claim.expected_lower_kwh, upper: claim.expected_upper_kwh }} />
            <SecurityVerificationCard checks={claim.fraud_score?.certificate?.checks ?? checksFromSecurity(claim.certificate_security)} result={claim.certificate_status} claimedBy={claim.ledger_record?.claimed_by} reason={claim.fraud_score?.certificate?.reason} />
          </div>
        </div>
      </div>
    </>
  );
}
