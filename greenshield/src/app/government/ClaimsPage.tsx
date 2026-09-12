import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useClaims, useEnums } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { FilterBar, Select } from '@/components/common/FilterBar';
import { SearchInput } from '@/components/common/SearchInput';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState, LoadingState } from '@/components/common/States';
import { fmtDate, fmtEnergy } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import type { Claim } from '@/types';

export default function ClaimsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const enums = useEnums();
  const filters = useMemo(() => ({
    status: params.get('status') ?? undefined, risk_level: params.get('risk_level') ?? undefined, energy_type: params.get('energy_type') ?? undefined,
    certificate_status: params.get('certificate_status') ?? undefined, min_risk: params.get('min_risk') ? Number(params.get('min_risk')) : undefined,
    date_from: params.get('date_from') ?? undefined, date_to: params.get('date_to') ?? undefined, plant_id: params.get('plant_id') ?? undefined,
    institution_id: params.get('institution_id') ?? undefined, search: search || undefined, limit: 200, order: 'risk_score DESC',
  }), [params, search]);
  const q = useClaims(filters);
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };
  const cols: Column<Claim>[] = [
    { key: 'claim_id', header: 'Claim ID', render: (c) => <span className="font-mono font-semibold">{c.claim_id}</span>, sortValue: (c) => c.claim_id },
    { key: 'cert_id', header: 'Certificate', render: (c) => <span className="font-mono">{c.cert_id}</span> },
    { key: 'plant', header: 'Generator', render: (c) => <span>{c.plant_id}<span className="block text-[11px] text-ink-3">{c.plant_name}</span></span> },
    { key: 'inst', header: 'Institution', render: (c) => <span>{c.institution_id}<span className="block text-[11px] text-ink-3">{c.institution_name}</span></span> },
    { key: 'period', header: 'Period', render: (c) => <span className="text-xs">{fmtDate(c.period_start)} – {fmtDate(c.period_end)}</span>, sortValue: (c) => c.period_start },
    { key: 'claimed', header: 'Claimed', align: 'right', render: (c) => fmtEnergy(c.claimed_kwh), sortValue: (c) => c.claimed_kwh },
    { key: 'expected', header: 'AI expected', align: 'right', render: (c) => fmtEnergy(c.expected_kwh), sortValue: (c) => c.expected_kwh },
    { key: 'actual', header: 'Actual', align: 'right', render: (c) => fmtEnergy(c.actual_kwh), sortValue: (c) => c.actual_kwh },
    { key: 'risk', header: 'Risk', render: (c) => <RiskBadge score={c.risk_score} level={c.risk_level} />, sortValue: (c) => c.risk_score },
    { key: 'cert_status', header: 'Certificate', render: (c) => <StatusBadge status={c.certificate_status} kind="certificate" /> },
    { key: 'status', header: 'Claim', render: (c) => <StatusBadge status={c.status} kind="claim" /> },
    { key: 'actions', header: 'Actions', render: (c) => <span className="flex gap-1" onClick={(e) => e.stopPropagation()}><Link className="btn btn-secondary btn-sm" to={ROUTES.government.claim(c.claim_id)}>Verify</Link>{c.case_id && <Link className="btn btn-ghost btn-sm" to={ROUTES.government.investigation(c.case_id)}>Case</Link>}</span> },
  ];
  return (
    <>
      <PageHeader eyebrow="Government portal" title="Claims" subtitle="Every submitted claim with its AI expectation, metered actual, certificate result and risk score." />
      <FilterBar>
        <SearchInput className="w-72" value={search} onChange={setSearch} placeholder="Search claim, certificate, generator, institution…" />
        <Select id="f-status" label="Claim status" value={params.get('status') ?? ''} onChange={(v) => set('status', v)} options={(enums.data?.claim_statuses ?? []).map((v) => ({ value: v, label: v.replace('_', ' ') }))} allLabel="All" />
        <Select id="f-risk" label="Risk" value={params.get('risk_level') ?? ''} onChange={(v) => set('risk_level', v)} options={(enums.data?.risk_levels ?? []).map((v) => ({ value: v, label: v }))} allLabel="All" />
        <Select id="f-energy" label="Energy type" value={params.get('energy_type') ?? ''} onChange={(v) => set('energy_type', v)} options={(enums.data?.energy_types ?? []).map((v) => ({ value: v, label: v }))} allLabel="All" />
        <Select id="f-cert" label="Certificate" value={params.get('certificate_status') ?? ''} onChange={(v) => set('certificate_status', v)} options={(enums.data?.certificate_statuses ?? []).map((v) => ({ value: v, label: v.replace('_', ' ') }))} allLabel="All" />
        <label className="flex flex-col gap-1 text-xs"><span className="label">From</span><input type="date" className="field py-1.5 text-sm" value={params.get('date_from') ?? ''} onChange={(e) => set('date_from', e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-xs"><span className="label">To</span><input type="date" className="field py-1.5 text-sm" value={params.get('date_to') ?? ''} onChange={(e) => set('date_to', e.target.value)} /></label>
        {[...params.keys()].length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setParams({}, { replace: true }); setSearch(''); }}>Clear filters</button>}
      </FilterBar>
      {q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <DataTable columns={cols} rows={q.data?.claims ?? []} rowKey={(c) => c.claim_id} loading={q.isLoading} onRowClick={(c) => navigate(ROUTES.government.claim(c.claim_id))} footer={q.data ? `${q.data.total} claim(s)` : undefined} />
      )}
    </>
  );
}
