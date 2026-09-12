import { Link, useNavigate, useParams } from 'react-router-dom';
import { useInstitution } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { KpiCard } from '@/components/common/KpiCard';
import { Panel } from '@/components/common/Panel';
import { DataTable } from '@/components/common/DataTable';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { fmtDate, fmtEnergy } from '@/lib/format';
import { ROUTES } from '@/lib/routes';

export default function InstitutionDetailPage() {
  const { id } = useParams();
  const q = useInstitution(id);
  const navigate = useNavigate();
  if (q.isLoading) return <LoadingState label="Loading institution…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  return (
    <>
      <PageHeader eyebrow={<Link to={ROUTES.government.institutions}>← Institutions</Link>} title={d.institution.name} subtitle={`${d.institution.institution_id} · ${d.institution.sector ?? ''} · ${d.institution.location ?? ''}`} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Purchased energy" value={fmtEnergy(d.kpis.total_purchased_energy_kwh)} tone="primary" />
        <KpiCard label="Verified energy" value={fmtEnergy(d.kpis.verified_energy_kwh)} tone="low" />
        <KpiCard label="Pending claims" value={d.kpis.pending_claims} tone="medium" />
        <KpiCard label="Flagged claims" value={d.kpis.flagged_claims} tone="high" />
        <KpiCard label="Duplicate attempts" value={d.kpis.duplicate_attempts} tone={d.kpis.duplicate_attempts ? 'critical' : 'low'} />
      </div>
      <Panel title="Claims" padded={false}>
        <DataTable rows={d.claims} rowKey={(c) => c.claim_id} onRowClick={(c) => navigate(ROUTES.government.claim(c.claim_id))} columns={[
          { key: 'claim_id', header: 'Claim', render: (c) => <span className="font-mono font-semibold">{c.claim_id}</span> },
          { key: 'cert', header: 'Certificate', render: (c) => <span className="font-mono">{c.cert_id}</span> },
          { key: 'plant', header: 'Generator', render: (c) => c.plant_id },
          { key: 'period', header: 'Period', render: (c) => `${fmtDate(c.period_start)} – ${fmtDate(c.period_end)}` },
          { key: 'claimed', header: 'Claimed', align: 'right', render: (c) => fmtEnergy(c.claimed_kwh), sortValue: (c) => c.claimed_kwh },
          { key: 'risk', header: 'Risk', render: (c) => <RiskBadge score={c.risk_score} level={c.risk_level} />, sortValue: (c) => c.risk_score },
          { key: 'cert_status', header: 'Certificate', render: (c) => <StatusBadge status={c.certificate_status} kind="certificate" /> },
          { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} kind="claim" /> },
        ]} />
      </Panel>
    </>
  );
}
