import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvestigations } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard } from '@/components/common/KpiCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { FilterBar, Select } from '@/components/common/FilterBar';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/States';
import { FRAUD_TYPE_LABEL } from '@/lib/risk';
import { fmtEnergy } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import type { Investigation } from '@/types';

export default function InvestigationsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const q = useInvestigations(status || undefined);
  const navigate = useNavigate();
  const cols: Column<Investigation>[] = [
    { key: 'case_id', header: 'Case ID', render: (c) => <span className="font-mono font-semibold">{c.case_id}</span>, sortValue: (c) => c.case_id },
    { key: 'claim_id', header: 'Claim', render: (c) => <span className="font-mono">{c.claim_id}</span> },
    { key: 'plant', header: 'Generator', render: (c) => <span>{c.plant_id}<span className="block text-[11px] text-ink-3">{c.plant_name}</span></span> },
    { key: 'inst', header: 'Institution', render: (c) => <span>{c.institution_id}<span className="block text-[11px] text-ink-3">{c.institution_name}</span></span> },
    { key: 'claimed', header: 'Claimed', align: 'right', render: (c) => fmtEnergy(c.claimed_kwh), sortValue: (c) => c.claimed_kwh },
    { key: 'risk', header: 'Risk', render: (c) => <RiskBadge score={c.risk_score} level={c.risk_level} />, sortValue: (c) => c.risk_score },
    { key: 'fraud', header: 'Fraud type', render: (c) => FRAUD_TYPE_LABEL[c.fraud_type ?? 'none'] ?? c.fraud_type },
    { key: 'officer', header: 'Assigned officer', render: (c) => c.assigned_officer ?? '—' },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} kind="investigation" /> },
  ];
  const s = q.data?.stats;
  return (
    <>
      <PageHeader eyebrow="Government portal" title="Investigation center" subtitle="Cases opened automatically for flagged claims. Review evidence, then approve, reject or request more data." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Open investigations" value={s?.open ?? '—'} tone="high" onClick={() => setParams({ status: 'open' })} />
        <KpiCard label="Critical cases" value={s?.critical ?? '—'} tone="critical" />
        <KpiCard label="Awaiting evidence" value={s?.awaiting_evidence ?? '—'} tone="medium" onClick={() => setParams({ status: 'awaiting_evidence' })} />
        <KpiCard label="Resolved" value={s?.resolved ?? '—'} tone="low" hint={s ? `${s.resolved_approved} approved · ${s.resolved_rejected} rejected` : undefined} />
      </div>
      <FilterBar>
        <Select id="inv-status" label="Status" value={status} onChange={(v) => setParams(v ? { status: v } : {})} allLabel="All cases" options={[{ value: 'open', label: 'Open' }, { value: 'awaiting_evidence', label: 'Awaiting evidence' }, { value: 'resolved_approved', label: 'Resolved — approved' }, { value: 'resolved_rejected', label: 'Resolved — rejected' }]} />
      </FilterBar>
      {q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <DataTable columns={cols} rows={q.data?.cases ?? []} rowKey={(c) => c.case_id} loading={q.isLoading} onRowClick={(c) => navigate(ROUTES.government.investigation(c.case_id))} />}
    </>
  );
}
