import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Brain, FileBadge2, Activity, Cloud, BookOpenCheck, Link2 } from 'lucide-react';
import { useDecideInvestigation, useInvestigation } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RiskBadge } from '@/components/common/RiskBadge';
import { Panel } from '@/components/common/Panel';
import { Timeline } from '@/components/common/Timeline';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { EvidenceCard } from '@/components/fraud/EvidenceCard';
import { EnergyComparisonCard } from '@/components/claims/EnergyComparisonCard';
import { SecurityVerificationCard, checksFromSecurity } from '@/components/security/SecurityVerificationCard';
import { ChartCard } from '@/components/charts/ChartCard';
import { LineChart } from '@/components/charts/LineChart';
import { chartColor } from '@/components/charts/palette';
import { DataTable } from '@/components/common/DataTable';
import { fmtDate, fmtDateTime, fmtEnergy, fmtNumber, fmtTime, shortHash, titleCase } from '@/lib/format';
import { FRAUD_TYPE_LABEL } from '@/lib/risk';
import { ROUTES } from '@/lib/routes';
import type { ApiError, Claim, Decision } from '@/types';

export default function InvestigationDetailPage() {
  const { id } = useParams();
  const q = useInvestigation(id);
  const decide = useDecideInvestigation();
  const toast = useToast();
  const [dialog, setDialog] = useState<Decision | null>(null);
  if (q.isLoading) return <LoadingState label="Loading case…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const c = q.data; const claim = c.claim; const ev = c.evidence;
  const open = c.status === 'open' || c.status === 'awaiting_evidence';
  const series = ev.predictions.map((p) => ({ date: p.date, predicted: p.predicted_kwh, lower: p.lower, upper: p.upper, actual: ev.generation.find((g) => g.date === p.date)?.actual_kwh ?? null }));
  const run = async (note?: string) => {
    if (!dialog) return;
    try { await decide.mutateAsync({ id: c.case_id, decision: dialog, note }); toast.success(`${c.case_id} — ${titleCase(dialog)}`, 'Claim status and audit trail updated.'); setDialog(null); }
    catch (e) { toast.error('Decision failed', (e as ApiError).message); }
  };
  const relCols = [
    { key: 'claim_id', header: 'Claim', render: (r: Claim) => <Link to={ROUTES.government.claim(r.claim_id)} className="font-mono">{r.claim_id}</Link> },
    { key: 'cp', header: 'Counterparty', render: (r: Claim) => `${r.institution_id} ↔ ${r.plant_id}` },
    { key: 'claimed', header: 'Claimed', align: 'right' as const, render: (r: Claim) => fmtEnergy(r.claimed_kwh) },
    { key: 'risk', header: 'Risk', render: (r: Claim) => <RiskBadge score={r.risk_score} level={r.risk_level} /> },
    { key: 'status', header: 'Status', render: (r: Claim) => <StatusBadge status={r.status} kind="claim" /> },
  ];
  return (
    <>
      <PageHeader eyebrow={<Link to={ROUTES.government.investigations}>← Investigations</Link>} title={<>Case <span className="font-mono">{c.case_id}</span></>} subtitle={`${FRAUD_TYPE_LABEL[c.fraud_type ?? 'none'] ?? c.fraud_type} · assigned to ${c.assigned_officer ?? 'unassigned'} · opened ${fmtDateTime(c.opened_at)}`}
        actions={<>
          <StatusBadge status={c.status} kind="investigation" />
          {claim && <Link className="btn btn-secondary btn-sm" to={ROUTES.government.claim(claim.claim_id)}>Open claim</Link>}
          {open && <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog('request_evidence')}>Request More Data</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setDialog('reject')}>Reject</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setDialog('approve')} disabled={!claim || !['VALID', 'NOT_PROVIDED', null].includes(claim.certificate_status)}>Approve</button>
          </>}
        </>} />
      {!claim ? <Panel><p className="text-sm text-ink-3">The claim behind this case no longer exists.</p></Panel> : (
        <>
          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <EvidenceCard title="Case summary" icon={BookOpenCheck} tone={c.risk_score && c.risk_score > 80 ? 'critical' : 'default'} items={[
              { label: 'Claim', value: claim.claim_id, mono: true }, { label: 'Certificate', value: claim.cert_id, mono: true },
              { label: 'Generator', value: `${claim.plant_id} · ${c.plant?.name ?? ''}` }, { label: 'Institution', value: `${claim.institution_id} · ${c.institution?.name ?? ''}` },
              { label: 'Period', value: `${fmtDate(claim.period_start)} – ${fmtDate(claim.period_end)}` }, { label: 'Risk', value: <RiskBadge score={claim.risk_score} level={claim.risk_level} /> },
            ]}>{c.resolution_note && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">{c.resolution_note}</p>}</EvidenceCard>
            <EvidenceCard title="AI evidence" icon={Brain} items={ev.ai ? [
              { label: 'Expected', value: fmtEnergy(ev.ai.metrics.expected_kwh) }, { label: 'Actual', value: fmtEnergy(ev.ai.metrics.actual_kwh) },
              { label: 'Deviation vs expected', value: `${fmtNumber(ev.ai.metrics.deviation_vs_expected_pct, 1)}%` }, { label: 'Deviation vs actual', value: `${fmtNumber(ev.ai.metrics.deviation_vs_actual_pct, 1)}%` },
              { label: 'Historical expectation', value: fmtEnergy(ev.ai.metrics.historical_expected_kwh) }, { label: 'Physical maximum', value: fmtEnergy(ev.ai.metrics.capacity_max_kwh) },
            ] : []}>
              {ev.ai && <ul className="mt-3 space-y-1 text-sm">{ev.ai.findings.filter((f) => f.severity !== 'OK').map((f, i) => <li key={i}><span className="chip mr-2 bg-surface-2 text-ink-2">{f.severity}</span>{f.text}</li>)}</ul>}
            </EvidenceCard>
            <EvidenceCard title="Certificate evidence" icon={FileBadge2} items={[
              { label: 'Result', value: <StatusBadge status={claim.certificate_status} kind="certificate" /> }, { label: 'Verified at', value: fmtDateTime(ev.certificate?.verified_at) },
              { label: 'SHA-256 in payload', value: shortHash(ev.certificate?.sha256_hash, 14), mono: true }, { label: 'Ledger hash', value: shortHash(ev.ledger?.data_hash, 14), mono: true },
              { label: 'Ledger status', value: ev.ledger ? `${ev.ledger.status}${ev.ledger.claimed_by ? ` by ${ev.ledger.claimed_by}` : ''}` : 'NOT FOUND' }, { label: 'Signed generator', value: (ev.steg_payload?.generator_id as string) ?? '—' },
            ]} />
          </div>
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <EnergyComparisonCard claimed={claim.claimed_kwh} expected={claim.expected_kwh} actual={claim.actual_kwh} range={{ lower: claim.expected_lower_kwh, upper: claim.expected_upper_kwh }} />
            <SecurityVerificationCard checks={ev.ai?.certificate?.checks ?? checksFromSecurity(ev.certificate)} result={claim.certificate_status} claimedBy={ev.ledger?.claimed_by} reason={ev.ai?.certificate?.reason} />
          </div>
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Generation evidence" subtitle="Metered output vs AI prediction interval around the claim period" legend={[{ label: 'Actual', color: chartColor.actual }, { label: 'AI predicted', color: chartColor.expected, dashed: true }]}>
              {series.length ? <LineChart data={series} xKey="date" series={[{ key: 'actual', label: 'Actual', color: chartColor.actual }, { key: 'predicted', label: 'AI predicted', color: chartColor.expected, dashed: true }]} band={{ lowKey: 'lower', highKey: 'upper' }} yFormatter={(v) => fmtEnergy(v)} xFormatter={(d) => d.slice(5)} /> : <p className="text-sm text-ink-3">No generation series.</p>}
            </ChartCard>
            <ChartCard title="Weather evidence" subtitle="Irradiance and wind through the period" legend={[{ label: 'Irradiance kWh/m²', color: chartColor.accent }, { label: 'Wind m/s', color: chartColor.info }]}>
              {ev.weather.length ? <LineChart data={ev.weather.map((w) => ({ date: w.date, irr: w.solar_irradiance_kwh_m2, wind: w.wind_speed_ms }))} xKey="date" series={[{ key: 'irr', label: 'Irradiance', color: chartColor.accent }, { key: 'wind', label: 'Wind', color: chartColor.info }]} xFormatter={(d) => d.slice(5)} /> : <p className="text-sm text-ink-3">No weather series.</p>}
            </ChartCard>
          </div>
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Related claims — same generator" padded={false}><DataTable dense columns={relCols} rows={c.related_claims.same_plant} rowKey={(r) => r.claim_id} emptyText="No other claims for this plant." /></Panel>
            <Panel title="Related claims — same institution" padded={false}><DataTable dense columns={relCols} rows={c.related_claims.same_institution} rowKey={(r) => r.claim_id} emptyText="No other claims from this institution." /></Panel>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Panel title="Audit history"><Timeline compact items={c.audit.map((e) => ({ id: e.id, time: fmtTime(e.timestamp), title: e.action, actor: e.actor, detail: e.detail, meta: e.entry_hash ? `hash ${shortHash(e.entry_hash, 10)}` : undefined }))} /></Panel>
            <EvidenceCard title="Ledger evidence" icon={Activity} items={ev.ledger ? [
              { label: 'Certificate', value: ev.ledger.cert_id, mono: true }, { label: 'Issuer', value: ev.ledger.issuer_id }, { label: 'Energy on certificate', value: fmtEnergy(ev.ledger.energy_kwh) },
              { label: 'Generation date', value: fmtDate(ev.ledger.generation_date) }, { label: 'Issued', value: fmtDateTime(ev.ledger.issued_at) }, { label: 'Immutable id', value: ev.ledger.uid ?? '—', mono: true },
            ] : []}>{!ev.ledger && <p className="text-sm text-ink-3 inline-flex items-center gap-2"><Cloud size={14} />No ledger record for this certificate ID.</p>}<p className="mt-3 inline-flex items-center gap-2 text-xs text-ink-3"><Link2 size={12} />Related entities: {c.related_claims.same_institution.length + c.related_claims.same_plant.length} claims</p></EvidenceCard>
          </div>
        </>
      )}
      <ConfirmDialog open={dialog !== null} onClose={() => setDialog(null)} onConfirm={run} busy={decide.isPending}
        title={dialog === 'approve' ? 'Approve claim' : dialog === 'reject' ? 'Reject claim' : 'Request more data'}
        message={dialog === 'approve' ? 'Approve the claim and mark the certificate as claimed. Recorded permanently.' : dialog === 'reject' ? 'Reject the claim. The decision and your note are written to the tamper-evident audit trail.' : 'Move the case to Awaiting Evidence and notify the institution.'}
        confirmLabel={dialog === 'approve' ? 'Approve' : dialog === 'reject' ? 'Reject claim' : 'Request evidence'} tone={dialog === 'reject' ? 'danger' : 'primary'} withNote />
    </>
  );
}
