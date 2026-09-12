import { useState } from 'react';
import { useGeneration } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { FilterBar } from '@/components/common/FilterBar';
import { ErrorState } from '@/components/common/States';
import { API_BASE } from '@/services/api/client';
import { fmtDate, fmtEnergy, fmtNumber } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { Link } from 'react-router-dom';

export default function GenerationPage() {
  const plantId = useAuth((s) => s.user?.entity_id);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const q = useGeneration(plantId, { start: start || undefined, end: end || undefined, limit: 500 });
  return (
    <>
      <PageHeader eyebrow="Generator portal" title="Generation data" subtitle="Metered and reported generation with the AI prediction for each day." actions={<><a className="btn btn-secondary btn-sm" href={`${API_BASE}/api/generation/${plantId}/template.csv`}>CSV template</a><Link className="btn btn-primary btn-sm" to={ROUTES.generator.submit}>Upload Generation Data</Link></>} />
      <FilterBar>
        <label className="flex flex-col gap-1 text-xs"><span className="label">From</span><input type="date" className="field py-1.5 text-sm" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-xs"><span className="label">To</span><input type="date" className="field py-1.5 text-sm" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </FilterBar>
      {q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <DataTable rows={[...(q.data?.rows ?? [])].reverse()} rowKey={(r) => `${r.date}-${r.hour ?? 'd'}`} loading={q.isLoading} columns={[
          { key: 'date', header: 'Date', render: (r) => fmtDate(r.date), sortValue: (r) => r.date },
          { key: 'time', header: 'Time', render: (r) => (r.hour === null || r.hour === undefined ? 'Daily total' : `${String(r.hour).padStart(2, '0')}:00`) },
          { key: 'gen', header: 'Generation', align: 'right', render: (r) => fmtEnergy(r.generation_kwh), sortValue: (r) => r.generation_kwh },
          { key: 'pred', header: 'AI predicted', align: 'right', render: (r) => fmtEnergy(r.predicted_kwh) },
          { key: 'meter', header: 'Meter reading', align: 'right', render: (r) => (r.meter_reading_kwh != null ? `${fmtNumber(r.meter_reading_kwh)} kWh` : '—') },
          { key: 'hours', header: 'Operating hours', align: 'right', render: (r) => (r.operating_hours != null ? fmtNumber(r.operating_hours, 1) : '—') },
          { key: 'src', header: 'Source', render: (r) => r.source },
        ]} footer={q.data ? `${q.data.count} row(s)` : undefined} />
      )}
    </>
  );
}
