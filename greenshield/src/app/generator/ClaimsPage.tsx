import { useClaims } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/States';
import { fmtDate, fmtEnergy } from '@/lib/format';

export default function GeneratorClaimsPage() {
  const plantId = useAuth((s) => s.user?.entity_id) ?? undefined;
  const q = useClaims({ plant_id: plantId, limit: 200 });
  return (
    <>
      <PageHeader eyebrow="Generator portal" title="Claims on my generation" subtitle="Institutions claiming RECs issued against this plant's output." />
      {q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <DataTable rows={q.data?.claims ?? []} rowKey={(c) => c.claim_id} loading={q.isLoading} columns={[
          { key: 'claim_id', header: 'Claim', render: (c) => <span className="font-mono font-semibold">{c.claim_id}</span> },
          { key: 'cert', header: 'Certificate', render: (c) => <span className="font-mono">{c.cert_id}</span> },
          { key: 'inst', header: 'Institution', render: (c) => <span>{c.institution_id}<span className="block text-[11px] text-ink-3">{c.institution_name}</span></span> },
          { key: 'period', header: 'Period', render: (c) => `${fmtDate(c.period_start)} – ${fmtDate(c.period_end)}` },
          { key: 'claimed', header: 'Claimed', align: 'right', render: (c) => fmtEnergy(c.claimed_kwh) },
          { key: 'actual', header: 'Our metered', align: 'right', render: (c) => fmtEnergy(c.actual_kwh) },
          { key: 'risk', header: 'Risk', render: (c) => <RiskBadge score={c.risk_score} level={c.risk_level} /> },
          { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} kind="claim" /> },
        ]} />
      )}
    </>
  );
}
