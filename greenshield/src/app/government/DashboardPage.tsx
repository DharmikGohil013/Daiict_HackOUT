import { Link, useNavigate } from 'react-router-dom';
import { Factory, FileSearch, Zap, Clock, AlertTriangle, ShieldAlert, ShieldCheck, ShieldX, Gavel } from 'lucide-react';
import { useGovernmentDashboard, useInvestigations } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard } from '@/components/common/KpiCard';
import { Panel } from '@/components/common/Panel';
import { ErrorState, LoadingState } from '@/components/common/States';
import { DataTable, type Column } from '@/components/common/DataTable';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Timeline } from '@/components/common/Timeline';
import { ChartCard } from '@/components/charts/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { chartColor } from '@/components/charts/palette';
import { EnergyComparisonCard } from '@/components/claims/EnergyComparisonCard';
import { AlertsList } from '@/components/dashboard/AlertsList';
import { fmtEnergy, fmtNumber, fmtTime, shortHash } from '@/lib/format';
import { FRAUD_TYPE_LABEL } from '@/lib/risk';
import { ROUTES } from '@/lib/routes';
import type { Claim } from '@/types';

export default function DashboardPage() {
  const q = useGovernmentDashboard();
  const inv = useInvestigations('open');
  const navigate = useNavigate();
  if (q.isLoading) return <LoadingState label="Loading government dashboard…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const queue = (inv.data?.cases ?? []).slice(0, 6);
  const cols: Column<Claim>[] = [
    { key: 'claim_id', header: 'Claim ID', render: (c) => <span className="font-mono font-semibold">{c.claim_id}</span> },
    { key: 'plant_id', header: 'Generator', render: (c) => <span>{c.plant_id}<span className="block text-[11px] text-ink-3">{c.plant_name}</span></span> },
    { key: 'institution_id', header: 'Institution', render: (c) => c.institution_id },
    { key: 'claimed_kwh', header: 'Claimed', align: 'right', render: (c) => fmtEnergy(c.claimed_kwh), sortValue: (c) => c.claimed_kwh },
    { key: 'expected_kwh', header: 'Expected', align: 'right', render: (c) => fmtEnergy(c.expected_kwh), sortValue: (c) => c.expected_kwh },
    { key: 'actual_kwh', header: 'Actual', align: 'right', render: (c) => fmtEnergy(c.actual_kwh), sortValue: (c) => c.actual_kwh },
    { key: 'risk', header: 'Risk', render: (c) => <RiskBadge score={c.risk_score} level={c.risk_level} />, sortValue: (c) => c.risk_score },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} kind="claim" /> },
  ];
  return (
    <>
      <PageHeader eyebrow="Government portal" title="Verification dashboard" subtitle="System-wide claims, AI generation checks, certificate security and open investigations." actions={<Link className="btn btn-primary btn-sm" to={ROUTES.government.investigations}><Gavel size={14} /> {d.investigations.open + d.investigations.awaiting_evidence} open case(s)</Link>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Registered plants" value={fmtNumber(d.kpis.registered_plants)} icon={Factory} tone="primary" onClick={() => navigate(ROUTES.government.plants)} />
        <KpiCard label="Active claims" value={fmtNumber(d.kpis.active_claims)} icon={FileSearch} onClick={() => navigate(ROUTES.government.claims)} />
        <KpiCard label="Verified energy" value={fmtEnergy(d.kpis.verified_energy_kwh)} icon={Zap} tone="low" />
        <KpiCard label="Pending verification" value={fmtNumber(d.kpis.pending_verification)} icon={Clock} tone="medium" onClick={() => navigate(`${ROUTES.government.claims}?status=flagged`)} />
        <KpiCard label="Suspicious claims" value={fmtNumber(d.kpis.suspicious_claims)} icon={AlertTriangle} tone="high" onClick={() => navigate(`${ROUTES.government.claims}?min_risk=61`)} />
        <KpiCard label="Critical risk" value={fmtNumber(d.kpis.critical_risk)} icon={ShieldAlert} tone="critical" onClick={() => navigate(`${ROUTES.government.claims}?risk_level=CRITICAL`)} />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Verification overview" subtitle="Claims by outcome">
          <DonutChart data={[
            { name: 'Verified', value: d.verification_overview.verified, color: chartColor.low },
            { name: 'Pending', value: d.verification_overview.pending, color: chartColor.medium },
            { name: 'Flagged', value: d.verification_overview.flagged, color: chartColor.high },
            { name: 'Rejected', value: d.verification_overview.rejected, color: chartColor.critical },
          ]} centerLabel="claims" />
        </ChartCard>
        <ChartCard title="Claimed vs AI expected vs actual" subtitle="By generation month" legend={[{ label: 'Claimed', color: chartColor.claimed }, { label: 'AI expected', color: chartColor.expected }, { label: 'Actual', color: chartColor.actual }]}>
          <BarChart data={d.comparison.by_month} xKey="month" series={[{ key: 'claimed_kwh', label: 'Claimed', color: chartColor.claimed }, { key: 'expected_kwh', label: 'AI expected', color: chartColor.expected }, { key: 'actual_kwh', label: 'Actual', color: chartColor.actual }]} yFormatter={(v) => fmtEnergy(v)} />
        </ChartCard>
        <ChartCard title="Fraud risk distribution" subtitle="Scored claims by level">
          <DonutChart data={[
            { name: 'Low', value: d.risk_distribution.LOW, color: chartColor.low }, { name: 'Medium', value: d.risk_distribution.MEDIUM, color: chartColor.medium },
            { name: 'High', value: d.risk_distribution.HIGH, color: chartColor.high }, { name: 'Critical', value: d.risk_distribution.CRITICAL, color: chartColor.critical },
          ]} centerLabel="scored" />
        </ChartCard>
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel title="Recent high-risk claims" subtitle="Risk ≥ 61 — open a row to verify" padded={false}>
          <DataTable columns={cols} rows={d.recent_high_risk} rowKey={(c) => c.claim_id} onRowClick={(c) => navigate(ROUTES.government.claim(c.claim_id))} dense emptyText="No high-risk claims." />
        </Panel>
        <div className="space-y-4">
          <Panel title="AI alerts"><AlertsList alerts={d.alerts} /></Panel>
          <EnergyComparisonCard title="All claims — totals" claimed={d.comparison.totals.claimed_kwh} expected={d.comparison.totals.expected_kwh} actual={d.comparison.totals.actual_kwh} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Investigation queue" subtitle={inv.data ? `${inv.data.stats.open} open · ${inv.data.stats.awaiting_evidence} awaiting evidence · ${inv.data.stats.critical} critical` : 'Open cases, highest risk first'} padded={false} actions={<Link className="btn btn-ghost btn-sm" to={ROUTES.government.investigations}>All cases</Link>}>
          {inv.isLoading ? <div className="p-4"><LoadingState /></div> : (
            <ul className="divide-y divide-line" data-testid="investigation-queue">
              {queue.map((c) => (
                <li key={c.case_id}>
                  <Link to={ROUTES.government.investigation(c.case_id)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink hover:bg-surface-2/70">
                    <span className="font-mono font-semibold">{c.case_id}</span>
                    <span className="min-w-0 flex-1 truncate">{FRAUD_TYPE_LABEL[c.fraud_type ?? 'none'] ?? c.fraud_type} · {c.plant_id} ← {c.institution_id}<span className="block text-[11px] text-ink-3">{c.assigned_officer ?? 'unassigned'} · {fmtEnergy(c.claimed_kwh)} claimed</span></span>
                    <RiskBadge score={c.risk_score} level={c.risk_level} />
                  </Link>
                </li>
              ))}
              {queue.length === 0 && <li className="px-4 py-3 text-sm text-ink-3">No open investigations.</li>}
            </ul>
          )}
        </Panel>
        <Panel title="Audit health" subtitle="Tamper-evident trail — every verification step is hash-chained" actions={<Link className="btn btn-ghost btn-sm" to={ROUTES.government.audit}>Open audit trail</Link>}>
          <div className="mb-3 grid gap-3 sm:grid-cols-3" data-testid="audit-health">
            <div className={`rounded-lg px-3 py-2 ${d.audit_chain.valid ? 'bg-low-soft text-low' : 'bg-critical-soft text-critical'}`}><div className="label opacity-80">Chain</div><div className="mt-0.5 inline-flex items-center gap-1 text-lg font-semibold">{d.audit_chain.valid ? <ShieldCheck size={16} /> : <ShieldX size={16} />}{d.audit_chain.valid ? 'Intact' : `Broken at #${d.audit_chain.broken_at_id}`}</div></div>
            <div className="rounded-lg bg-surface-2 px-3 py-2"><div className="label">Events</div><div className="num mt-0.5 text-lg font-semibold">{fmtNumber(d.audit_chain.entries)}</div></div>
            <div className="rounded-lg bg-surface-2 px-3 py-2"><div className="label">Certificates issued</div><div className="num mt-0.5 text-lg font-semibold">{fmtNumber(d.kpis.certificates_issued)}</div></div>
          </div>
          <Timeline compact items={d.recent_audit.slice(0, 6).map((e) => ({ id: e.id, time: fmtTime(e.timestamp), title: e.action, actor: e.actor, detail: e.claim_id ?? e.cert_id ?? undefined, meta: shortHash(e.entry_hash, 8), tone: /reject|blocked|MISMATCH|INVALID|NOT found|revoked/i.test(e.action) ? 'critical' : /approved|verified|issued|marked/i.test(e.action) ? 'low' : 'info' }))} />
        </Panel>
      </div>
    </>
  );
}
