import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useClaim, useDecideClaim } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Kv } from '@/components/common/Kv';
import { Panel } from '@/components/common/Panel';
import { Timeline } from '@/components/common/Timeline';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PhasePanel } from '@/components/common/PhasePanel';
import { useToast } from '@/components/common/Toast';
import { EnergyComparisonCard } from '@/components/claims/EnergyComparisonCard';
import { AiExplanationCard } from '@/components/claims/AiExplanationCard';
import { SecurityVerificationCard, checksFromSecurity } from '@/components/security/SecurityVerificationCard';
import { RiskGauge } from '@/components/charts/RiskGauge';
import { fmtDate, fmtDateTime, fmtEnergy, fmtTime, titleCase } from '@/lib/format';
import { FRAUD_TYPE_LABEL } from '@/lib/risk';
import { ROUTES } from '@/lib/routes';
import type { ApiError, Decision } from '@/types';

export default function ClaimDetailPage() {
  const { id } = useParams();
  const q = useClaim(id);
  const decide = useDecideClaim();
  const toast = useToast();
  const [dialog, setDialog] = useState<Decision | null>(null);
  if (q.isLoading) return <LoadingState label="Loading claim…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { claim, audit, investigation } = q.data;
  const score = claim.fraud_score;
  const decidable = !['approved', 'rejected'].includes(claim.status);
  const run = async (note?: string) => {
    if (!dialog) return;
    try {
      await decide.mutateAsync({ id: claim.claim_id, decision: dialog, note });
      toast.success(`Claim ${claim.claim_id} — ${titleCase(dialog)}`, 'Recorded in the audit trail.');
      setDialog(null);
    } catch (e) { toast.error('Decision failed', (e as ApiError).message); }
  };
  return (
    <>
      <PageHeader eyebrow={<Link to={ROUTES.government.claims}>← Claims</Link>} title={<>Claim Verification — <span className="font-mono">{claim.cert_id}</span></>} subtitle={`${claim.claim_id} · ${claim.institution_name ?? claim.institution_id} claims ${fmtEnergy(claim.claimed_kwh)} from ${claim.plant_name ?? claim.plant_id}`}
        actions={<>
          <StatusBadge status={claim.status} kind="claim" />
          {claim.case_id && <Link className="btn btn-secondary btn-sm" to={ROUTES.government.investigation(claim.case_id)}>Open investigation {claim.case_id}</Link>}
          {decidable && <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog('request_evidence')}>Request more data</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setDialog('reject')}>Reject</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setDialog('approve')} disabled={!['VALID', 'NOT_PROVIDED', null].includes(claim.certificate_status)}>Approve</button>
          </>}
        </>} />
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <Panel>
          <Kv cols={4} items={[
            { label: 'Generator', value: <>{claim.plant_id}<span className="block text-xs font-normal text-ink-3">{claim.plant_name} · {claim.energy_type} · {claim.capacity_mw} MW</span></> },
            { label: 'Institution', value: <>{claim.institution_id}<span className="block text-xs font-normal text-ink-3">{claim.institution_name}</span></> },
            { label: 'Certificate', value: <Link to={ROUTES.government.certificate(claim.cert_id)} className="font-mono">{claim.cert_id}</Link> },
            { label: 'Generation period', value: `${fmtDate(claim.period_start)} – ${fmtDate(claim.period_end)}` },
            { label: 'Claimed', value: <span className="text-critical">{fmtEnergy(claim.claimed_kwh)}</span> },
            { label: 'AI expected', value: fmtEnergy(claim.expected_kwh) },
            { label: 'Actual', value: fmtEnergy(claim.actual_kwh) },
            { label: 'Difference', value: claim.actual_kwh != null ? fmtEnergy(claim.claimed_kwh - claim.actual_kwh) : '—' },
            { label: 'Fraud type', value: FRAUD_TYPE_LABEL[claim.fraud_type ?? 'none'] },
            { label: 'Transaction', value: claim.transaction_id ?? '—', mono: true },
            { label: 'Submitted', value: fmtDateTime(claim.submitted_at) },
            { label: 'Decision', value: claim.decision ? `${titleCase(claim.decision)}${claim.decided_by ? ` · ${claim.decided_by}` : ''}` : 'Pending' },
          ]} />
          {claim.decision_note && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">{claim.decision_note}</p>}
        </Panel>
        <Panel className="flex flex-col items-center justify-center gap-2">
          <RiskGauge score={claim.risk_score ?? 0} level={claim.risk_level} thresholds={score?.thresholds} />
          <RiskBadge score={claim.risk_score} level={claim.risk_level} size="lg" />
        </Panel>
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <EnergyComparisonCard claimed={claim.claimed_kwh} expected={claim.expected_kwh} actual={claim.actual_kwh} range={{ lower: claim.expected_lower_kwh, upper: claim.expected_upper_kwh }} />
        <SecurityVerificationCard checks={score?.certificate?.checks ?? checksFromSecurity(claim.certificate_security)} result={claim.certificate_status} claimedBy={claim.ledger_record?.claimed_by} reason={score?.certificate?.reason} />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {score ? <AiExplanationCard score={score} /> : <Panel title="Why was this claim flagged?"><p className="text-sm text-ink-3">No fraud score recorded for this claim.</p></Panel>}
        <Panel title="Tamper-evident audit trail" subtitle={investigation ? `Investigation ${investigation.case_id} · ${investigation.assigned_officer ?? 'unassigned'}` : 'Every step of this verification'}>
          <Timeline compact items={audit.map((e) => ({ id: e.id, time: fmtTime(e.timestamp), title: e.action, actor: e.actor, detail: e.detail, tone: /reject|blocked|MISMATCH|INVALID|NOT found/i.test(e.action) ? 'critical' : /approved|verified|marked/i.test(e.action) ? 'low' : 'info' }))} />
        </Panel>
      </div>
      <PhasePanel phase={4} title="Generation vs prediction chart and weather evidence" description="the claim period plotted against the AI interval and metered output" />
      <ConfirmDialog open={dialog !== null} onClose={() => setDialog(null)} onConfirm={run} busy={decide.isPending}
        title={dialog === 'approve' ? 'Approve claim' : dialog === 'reject' ? 'Reject claim' : 'Request more data'}
        message={dialog === 'approve' ? `Approving ${claim.claim_id} will mark certificate ${claim.cert_id} as claimed by ${claim.institution_id}. This is atomic — if the certificate was claimed elsewhere first, the claim is rejected as a duplicate.` : dialog === 'reject' ? `Reject ${claim.claim_id}? The institution and generator will see the decision; the audit trail records who decided and why.` : `Ask ${claim.institution_id} for meter logs, O&M reports or other evidence before deciding.`}
        confirmLabel={dialog === 'approve' ? 'Approve' : dialog === 'reject' ? 'Reject claim' : 'Request evidence'} tone={dialog === 'reject' ? 'danger' : 'primary'} withNote />
    </>
  );
}
