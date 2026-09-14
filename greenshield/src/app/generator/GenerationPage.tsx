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
  const [viewMonth, setViewMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const { year, month } = viewMonth;

  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

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

  const prevMonth = () => setViewMonth(v => {
    const d = new Date(v.year, v.month - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const nextMonth = () => setViewMonth(v => {
    const d = new Date(v.year, v.month + 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  return (
    <div className="mb-8 p-5 bg-surface border border-line rounded-xl2 shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-display font-semibold text-ink">Daily Upload Status</h3>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn btn-ghost btn-sm px-2">‹</button>
          <span className="text-sm font-medium text-ink min-w-[140px] text-center">{monthName}</span>
          <button onClick={nextMonth} className="btn btn-ghost btn-sm px-2">›</button>
        </div>
      </div>
      {/* Legend */}
      <div className="flex gap-4 mb-3">
        <span className="flex items-center gap-1.5 text-xs text-ink-3"><span className="w-3 h-3 rounded-sm bg-low-soft border border-low/30 inline-block" />Uploaded</span>
        <span className="flex items-center gap-1.5 text-xs text-ink-3"><span className="w-3 h-3 rounded-sm bg-critical-soft border border-critical/30 inline-block" />Missing</span>
        <span className="flex items-center gap-1.5 text-xs text-ink-3"><span className="w-3 h-3 rounded-sm bg-medium-soft border border-medium/30 inline-block" />Pending</span>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1.5 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-ink-3 pb-1">{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(day => {
          const hasData = dataByDate.has(day);
          const r = dataByDate.get(day);
          const status = r?.status || 'approved';
          const dayNum = new Date(day + 'T12:00:00').getDate();
          const isToday = day === today.toISOString().split('T')[0];

          let cellClass = '';
          let labelText = 'Missing';
          if (hasData) {
            if (status === 'declined') {
              cellClass = 'bg-critical-soft text-critical border-critical/30 hover:opacity-80';
              labelText = 'Declined';
            } else if (status === 'pending') {
              cellClass = 'bg-medium-soft text-medium border-medium/30 hover:opacity-80';
              labelText = 'Pending';
            } else {
              cellClass = 'bg-low-soft text-low border-low/30 hover:opacity-80';
              labelText = 'OK';
            }
          } else {
            cellClass = 'bg-critical-soft/50 text-critical border-critical/20 hover:bg-critical-soft';
          }

          return (
            <button
              key={day}
              className={`p-1.5 border rounded-lg text-center transition-all duration-150 ${cellClass} ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
              onClick={() => {
                if (hasData) setSelectedDay(r);
                else navigate(`${ROUTES.generator.submit}?date=${day}`);
              }}
            >
              <div className="text-sm font-semibold leading-none">{dayNum}</div>
              <div className="text-[9px] mt-1 font-bold uppercase tracking-wide opacity-80">{labelText}</div>
            </button>
          );
        })}
      </div>

      {/* Day detail modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelectedDay(null)}>
          <div className="bg-surface rounded-xl2 shadow-xl p-6 max-w-md w-full border border-line" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-semibold text-ink">Data Status: {selectedDay.date}</h3>
              <button className="btn btn-ghost btn-sm px-2 text-ink-3" onClick={() => setSelectedDay(null)}>✕</button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-ink-3 text-sm">Status</span>
                <span className={`chip font-bold uppercase text-[10px] ${
                  selectedDay.status === 'declined' ? 'bg-critical-soft text-critical' :
                  selectedDay.status === 'pending' ? 'bg-medium-soft text-medium' :
                  'bg-low-soft text-low'
                }`}>{selectedDay.status || 'APPROVED'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-ink-3 text-sm">Generation</span>
                <span className="font-medium text-ink text-sm">{fmtEnergy(selectedDay.generation_kwh)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-ink-3 text-sm">AI Predicted</span>
                <span className="font-medium text-ink text-sm">{selectedDay.predicted_kwh != null ? fmtEnergy(selectedDay.predicted_kwh) : '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-ink-3 text-sm">Meter Reading</span>
                <span className="font-medium text-ink text-sm">{selectedDay.meter_reading_kwh != null ? `${fmtNumber(selectedDay.meter_reading_kwh)} kWh` : '—'}</span>
              </div>

              {selectedDay.status === 'approved' && (
                <div className="mt-4 p-3 bg-low-soft rounded-lg border border-low/30">
                  <p className="text-sm text-low font-medium mb-2">✓ REC Certificate Issued</p>
                  <div className="flex gap-3">
                    {selectedDay.file_name && (
                      <a href={`${API_BASE}/api/certificate/${selectedDay.file_name}`} download className="btn btn-sm btn-primary text-xs">
                        Download REC ↓
                      </a>
                    )}
                  </div>
                </div>
              )}
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
