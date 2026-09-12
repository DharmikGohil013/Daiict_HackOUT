import { useState, useMemo } from 'react';
import { useGeneration } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { FilterBar } from '@/components/common/FilterBar';
import { ErrorState } from '@/components/common/States';
import { API_BASE } from '@/services/api/client';
import { fmtDate, fmtEnergy, fmtNumber } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { Link, useNavigate } from 'react-router-dom';

function GenerationCalendar({ data }: { data: any[] }) {
  const navigate = useNavigate();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return d.toISOString().split('T')[0];
  });
  
  const dataByDate = useMemo(() => {
    const map = new Map();
    data.forEach(r => map.set(r.date, r));
    return map;
  }, [data]);
  
  const [selectedDay, setSelectedDay] = useState<any>(null);
  
  return (
    <div className="mb-8 p-4 bg-white border border-neutral-200 rounded-lg">
      <h3 className="text-lg font-medium mb-4">Daily Upload Status (This Month)</h3>
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-neutral-500">{d}</div>
        ))}
        {Array.from({ length: new Date(year, month, 1).getDay() }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(day => {
          const hasData = dataByDate.has(day);
          const r = dataByDate.get(day);
          const status = r?.status || 'approved';
          const colorClass = hasData 
             ? (status === 'declined' ? 'bg-red-200 text-red-900 border-red-300' : 
                status === 'pending' ? 'bg-yellow-100 text-yellow-900 border-yellow-300 hover:bg-yellow-200' :
                'bg-green-100 hover:bg-green-200 text-green-900 border-green-300') 
             : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200';
             
          return (
            <button 
              key={day}
              className={`p-2 border rounded-md text-center transition-colors ${colorClass}`}
              onClick={() => {
                if (hasData) {
                  setSelectedDay(r);
                } else {
                  navigate(`${ROUTES.generator.submit}?date=${day}`);
                }
              }}
            >
              <div className="text-sm font-medium">{new Date(day).getDate()}</div>
              <div className="text-[10px] mt-1 font-semibold uppercase">{hasData ? status : 'Missing'}</div>
            </button>
          )
        })}
      </div>
      
      {selectedDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Data Status: {selectedDay.date}</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-neutral-500">Status</span>
                <span className={`font-bold uppercase text-xs px-2 py-1 rounded ${
                  selectedDay.status === 'declined' ? 'bg-red-100 text-red-800' :
                  selectedDay.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>{selectedDay.status || 'APPROVED'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Generation</span>
                <span className="font-medium">{fmtEnergy(selectedDay.generation_kwh)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">AI Predicted</span>
                <span className="font-medium">{selectedDay.predicted_kwh != null ? fmtEnergy(selectedDay.predicted_kwh) : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Meter Reading</span>
                <span className="font-medium">{selectedDay.meter_reading_kwh != null ? `${fmtNumber(selectedDay.meter_reading_kwh)} kWh` : 'N/A'}</span>
              </div>
              
              {selectedDay.status === 'approved' && (
                <div className="mt-4 p-3 bg-green-50 rounded border border-green-100">
                  <p className="text-sm text-green-800 mb-2">REC Certificate Issued</p>
                  <div className="flex gap-4">
                    <Link to={ROUTES.generator.dashboard} className="text-xs font-semibold text-green-600 hover:underline">View in Dashboard &rarr;</Link>
                    {selectedDay.file_name && (
                      <a href={`${API_BASE}/api/certificate/${selectedDay.file_name}`} download className="text-xs font-semibold text-blue-600 hover:underline">Download REC &darr;</a>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button className="btn btn-secondary" onClick={() => setSelectedDay(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GenerationPage() {
  const plantId = useAuth((s) => s.user?.entity_id);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const q = useGeneration(plantId, { start: start || undefined, end: end || undefined, limit: 500 });
  
  return (
    <>
      <PageHeader eyebrow="Generator portal" title="Generation data" subtitle="Metered and reported generation with the AI prediction for each day." actions={<><a className="btn btn-secondary btn-sm" href={`${API_BASE}/api/generation/${plantId}/template.csv`}>CSV template</a><Link className="btn btn-primary btn-sm" to={ROUTES.generator.submit}>Upload Generation Data</Link></>} />
      
      {!q.isError && q.data && <GenerationCalendar data={q.data.rows} />}

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
          { key: 'status', header: 'Status', render: (r) => <span className="uppercase text-[10px] font-bold">{r.status || 'approved'}</span> },
          { key: 'meter', header: 'Meter reading', align: 'right', render: (r) => (r.meter_reading_kwh != null ? `${fmtNumber(r.meter_reading_kwh)} kWh` : '—') },
          { key: 'hours', header: 'Operating hours', align: 'right', render: (r) => (r.operating_hours != null ? fmtNumber(r.operating_hours, 1) : '—') },
          { key: 'src', header: 'Source', render: (r) => r.source },
        ]} footer={q.data ? `${q.data.count} row(s)` : undefined} />
      )}
    </>
  );
}
