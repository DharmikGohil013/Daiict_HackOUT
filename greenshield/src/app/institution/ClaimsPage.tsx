import { Link, useNavigate } from 'react-router-dom';
import { useClaims } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/States';
import { fmtDate, fmtEnergy } from '@/lib/format';
import { ROUTES } from '@/lib/routes';

export default function InstitutionClaimsPage() {
  const id = useAuth((s) => s.user?.entity_id) ?? undefined;
  const q = useClaims({ institution_id: id, limit: 200 });
  const navigate = useNavigate();
  return (
    <>
      <PageHeader eyebrow="Institution portal" title="My claims" actions={<Link className="btn btn-primary btn-sm" to={ROUTES.institution.submitClaim}>Submit claim</Link>} />
      {q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <DataTable rows={q.data?.claims ?? []} rowKey={(c) => c.claim_id} loading={q.isLoading} onRowClick={(c) => navigate(ROUTES.institution.claim(c.claim_id))} columns={[
          { key: 'claim_id', header: 'Claim', render: (c) => <span className="font-mono font-semibold">{c.claim_id}</span> },
          { key: 'cert', header: 'Certificate', render: (c) => <span className="font-mono">{c.cert_id}</span> },
          { key: 'plant', header: 'Generator', render: (c) => c.plant_name ?? c.plant_id },
          { key: 'period', header: 'Period', render: (c) => `${fmtDate(c.period_start)} – ${fmtDate(c.period_end)}` },
          { key: 'claimed', header: 'Claimed', align: 'right', render: (c) => fmtEnergy(c.claimed_kwh) },
          { key: 'cert_status', header: 'Certificate', render: (c) => <StatusBadge status={c.certificate_status} kind="certificate" /> },
          { key: 'risk', header: 'Risk', render: (c) => <RiskBadge score={c.risk_score} level={c.risk_level} /> },
          { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} kind="claim" /> },
        ]} />
      )}
    </>
  );
}
