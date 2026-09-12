import { Link, useNavigate } from 'react-router-dom';
import { useInstitutionDashboard } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard } from '@/components/common/KpiCard';
import { Panel } from '@/components/common/Panel';
import { DataTable } from '@/components/common/DataTable';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState, LoadingState } from '@/components/common/States';
import { fmtDate, fmtEnergy } from '@/lib/format';
import { ROUTES } from '@/lib/routes';

export default function InstitutionDashboardPage() {
  const id = useAuth((s) => s.user?.entity_id);
  const q = useInstitutionDashboard(id);
  const navigate = useNavigate();
  if (!id) return <Panel><p className="text-sm text-ink-3">Your account is not linked to an institution.</p></Panel>;
  if (q.isLoading) return <LoadingState label="Loading dashboard…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  return (
    <>
      <PageHeader eyebrow="Institution portal" title={d.institution.name} subtitle={`${d.institution.institution_id} · ${d.institution.sector ?? ''}`} actions={<Link className="btn btn-primary btn-sm" to={ROUTES.institution.submitClaim}>Submit claim</Link>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total purchased energy" value={fmtEnergy(d.kpis.total_purchased_energy_kwh)} tone="primary" />
        <KpiCard label="Verified energy" value={fmtEnergy(d.kpis.verified_energy_kwh)} tone="low" />
        <KpiCard label="Pending claims" value={d.kpis.pending_claims} tone="medium" />
        <KpiCard label="Flagged claims" value={d.kpis.flagged_claims} tone="high" />
        <KpiCard label="Duplicate attempts" value={d.kpis.duplicate_attempts} tone={d.kpis.duplicate_attempts ? 'critical' : 'low'} />
      </div>
      <Panel title="Recent claims" padded={false}>
        <DataTable rows={d.claims} rowKey={(c) => c.claim_id} onRowClick={(c) => navigate(ROUTES.institution.claim(c.claim_id))} columns={[
          { key: 'claim_id', header: 'Claim', render: (c) => <span className="font-mono font-semibold">{c.claim_id}</span> },
          { key: 'cert', header: 'Certificate', render: (c) => <span className="font-mono">{c.cert_id}</span> },
          { key: 'plant', header: 'Generator', render: (c) => c.plant_name ?? c.plant_id },
          { key: 'period', header: 'Period', render: (c) => `${fmtDate(c.period_start)} – ${fmtDate(c.period_end)}` },
          { key: 'claimed', header: 'Claimed', align: 'right', render: (c) => fmtEnergy(c.claimed_kwh) },
          { key: 'risk', header: 'Risk', render: (c) => <RiskBadge score={c.risk_score} level={c.risk_level} /> },
          { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} kind="claim" /> },
        ]} />
      </Panel>
    </>
  );
}
