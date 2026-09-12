import { useGeneratorDashboard } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard } from '@/components/common/KpiCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState, LoadingState } from '@/components/common/States';
import { ChartCard } from '@/components/charts/ChartCard';
import { LineChart } from '@/components/charts/LineChart';
import { chartColor } from '@/components/charts/palette';
import { WeatherCard } from '@/components/dashboard/WeatherCard';
import { Panel } from '@/components/common/Panel';
import { fmtEnergy, fmtNumber, fmtPct } from '@/lib/format';

export default function GeneratorDashboardPage() {
  const plantId = useAuth((s) => s.user?.entity_id);
  const q = useGeneratorDashboard(plantId);
  if (!plantId) return <Panel><p className="text-sm text-ink-3">Your account is not linked to a plant.</p></Panel>;
  if (q.isLoading) return <LoadingState label="Loading plant dashboard…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  return (
    <>
      <PageHeader eyebrow="Generator portal" title={d.plant.name} subtitle={`${d.plant.plant_id} · ${fmtNumber(d.plant.capacity_mw, 1)} MW ${d.plant.energy_type} · ${d.plant.location}`} actions={<StatusBadge status={d.today.status} />} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Today's generation" value={fmtEnergy(d.today.generation_kwh)} hint={d.today.date ?? undefined} tone="primary" />
        <KpiCard label="AI expected" value={fmtEnergy(d.today.expected?.predicted_kwh)} hint={d.today.expected ? `${fmtEnergy(d.today.expected.lower)} – ${fmtEnergy(d.today.expected.upper)}` : undefined} />
        <KpiCard label="Deviation" value={fmtPct(d.today.deviation_pct, 1, true)} tone={d.today.status === 'NORMAL' ? 'low' : d.today.status === 'WATCH' ? 'medium' : 'critical'} />
        <KpiCard label="Status" value={d.today.status} tone={d.today.status === 'NORMAL' ? 'low' : d.today.status === 'WATCH' ? 'medium' : 'critical'} />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <ChartCard title="Last 30 days" subtitle="Metered vs AI predicted (shaded: 10–90% interval)" legend={[{ label: 'Actual', color: chartColor.actual }, { label: 'AI predicted', color: chartColor.expected, dashed: true }]}>
          <LineChart data={d.series_30d.map((s) => ({ date: s.date, actual: s.actual_kwh, predicted: s.predicted_kwh, lower: s.lower, upper: s.upper }))} xKey="date" series={[{ key: 'actual', label: 'Actual', color: chartColor.actual }, { key: 'predicted', label: 'AI predicted', color: chartColor.expected, dashed: true }]} band={{ lowKey: 'lower', highKey: 'upper' }} yFormatter={(v) => fmtEnergy(v)} xFormatter={(x) => x.slice(5)} />
        </ChartCard>
        <Panel title="Forecast" subtitle="Next 24 / 48 / 72 hours">
          <ul className="space-y-2">{d.forecast.map((f) => <li key={f.horizon_hours} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"><span>Next {f.horizon_hours} hours<span className="block text-[11px] text-ink-3">{f.target_date}</span></span><span className="num text-right font-semibold">{fmtEnergy(f.predicted_kwh)}<span className="block text-[11px] font-normal text-ink-3">{fmtEnergy(f.lower_bound_kwh)} – {fmtEnergy(f.upper_bound_kwh)}</span></span></li>)}</ul>
        </Panel>
      </div>
      <WeatherCard weather={d.weather} date={d.today.date} />
    </>
  );
}
