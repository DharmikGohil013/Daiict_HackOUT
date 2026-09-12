import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlants } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { FilterBar, Select } from '@/components/common/FilterBar';
import { SearchInput } from '@/components/common/SearchInput';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/States';
import { fmtEnergy, fmtNumber } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import type { PlantWithStats } from '@/types';

export default function PlantsPage() {
  const [search, setSearch] = useState('');
  const [energy, setEnergy] = useState('');
  const q = usePlants({ search: search || undefined, energy_type: energy || undefined });
  const navigate = useNavigate();
  const cols: Column<PlantWithStats>[] = [
    { key: 'plant_id', header: 'Plant ID', render: (p) => <span className="font-mono font-semibold">{p.plant_id}</span>, sortValue: (p) => p.plant_id },
    { key: 'name', header: 'Plant name', render: (p) => p.name, sortValue: (p) => p.name },
    { key: 'type', header: 'Energy type', render: (p) => p.energy_type },
    { key: 'loc', header: 'Location', render: (p) => p.location },
    { key: 'cap', header: 'Installed capacity', align: 'right', render: (p) => `${fmtNumber(p.capacity_mw, 1)} MW`, sortValue: (p) => p.capacity_mw },
    { key: 'gen', header: 'Generation', align: 'right', render: (p) => fmtEnergy(p.generation_kwh), sortValue: (p) => p.generation_kwh },
    { key: 'claims', header: 'Claims', align: 'right', render: (p) => p.claims, sortValue: (p) => p.claims },
    { key: 'flagged', header: 'Flagged', align: 'right', render: (p) => <span className={p.flagged_claims ? 'text-critical font-semibold' : ''}>{p.flagged_claims}</span>, sortValue: (p) => p.flagged_claims },
    { key: 'risk', header: 'Risk', render: (p) => <RiskBadge score={Math.round(p.max_risk)} />, sortValue: (p) => p.max_risk },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} kind="plant" /> },
  ];
  return (
    <>
      <PageHeader eyebrow="Government portal" title="Plant registry" subtitle="Registered renewable generators with metered output, claim activity and risk." />
      <FilterBar>
        <SearchInput className="w-72" value={search} onChange={setSearch} placeholder="Search plant, location…" />
        <Select id="p-energy" label="Energy type" value={energy} onChange={setEnergy} allLabel="All" options={['Solar', 'Wind', 'Hydro', 'Biomass', 'Other'].map((v) => ({ value: v, label: v }))} />
      </FilterBar>
      {q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <DataTable columns={cols} rows={q.data?.plants ?? []} rowKey={(p) => p.plant_id} loading={q.isLoading} onRowClick={(p) => navigate(ROUTES.government.plant(p.plant_id))} initialSort={{ key: 'risk', dir: 'desc' }} />}
    </>
  );
}
