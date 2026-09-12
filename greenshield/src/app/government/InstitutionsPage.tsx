import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInstitutions } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { SearchInput } from '@/components/common/SearchInput';
import { FilterBar } from '@/components/common/FilterBar';
import { ErrorState } from '@/components/common/States';
import { StatusBadge } from '@/components/common/StatusBadge';
import { fmtDate } from '@/lib/format';
import { ROUTES } from '@/lib/routes';

export default function InstitutionsPage() {
  const [search, setSearch] = useState('');
  const q = useInstitutions(search || undefined);
  const navigate = useNavigate();
  return (
    <>
      <PageHeader eyebrow="Government portal" title="Institutions" subtitle="Claimants and REC buyers registered on the platform." />
      <FilterBar><SearchInput className="w-72" value={search} onChange={setSearch} placeholder="Search institution…" /></FilterBar>
      {q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <DataTable rows={q.data?.institutions ?? []} rowKey={(i) => i.institution_id} loading={q.isLoading} onRowClick={(i) => navigate(ROUTES.government.institution(i.institution_id))} columns={[
          { key: 'id', header: 'Institution ID', render: (i) => <span className="font-mono font-semibold">{i.institution_id}</span>, sortValue: (i) => i.institution_id },
          { key: 'name', header: 'Name', render: (i) => i.name, sortValue: (i) => i.name },
          { key: 'sector', header: 'Sector', render: (i) => i.sector ?? '—' },
          { key: 'loc', header: 'Location', render: (i) => i.location ?? '—' },
          { key: 'reg', header: 'Registered', render: (i) => fmtDate(i.registered_at) },
          { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} kind="plant" /> },
        ]} />
      )}
    </>
  );
}
