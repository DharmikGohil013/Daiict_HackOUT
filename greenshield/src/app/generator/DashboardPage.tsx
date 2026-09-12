import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGeneratorDashboard } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard } from '@/components/common/KpiCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RiskBadge } from '@/components/common/RiskBadge';
import { ErrorState, LoadingState } from '@/components/common/States';
import { ChartCard } from '@/components/charts/ChartCard';
import { LineChart } from '@/components/charts/LineChart';
import { chartColor } from '@/components/charts/palette';
import { WeatherCard } from '@/components/dashboard/WeatherCard';
import { Panel } from '@/components/common/Panel';
import { cn } from '@/lib/cn';
import { fmtDate, fmtEnergy, fmtNumber, fmtPct } from '@/lib/format';
import { ROUTES } from '@/lib/routes';

type Range = 'today' | '7d' | '30d';

export default function GeneratorDashboardPage() {
  const plantId = useAuth((s) => s.user?.entity_id);
  const q = useGeneratorDashboard(plantId);
  const [range, setRange] = useState<Range>('30d');
  if (!plantId) return <Panel><p className="text-sm text-ink-3">Your account is not linked to a plant.</p></Panel>;
  if (q.isLoading) return <LoadingState label="Loading plant dashboard…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const tone = d.today.status === 'NORMAL' ? 'low' : d.today.status === 'WATCH' ? 'medium' : d.today.status === 'ANOMALY' ? 'critical' : 'info';
  const series = d.series_30d.map((s) => ({ date: s.date, actual: s.actual_kwh, predicted: s.predicted_kwh, lower: s.lower, upper: s.upper }));
  const shown = range === '30d' ? series : range === '7d' ? series.slice(-7) : series.slice(-1);
  const rangeActual = shown.reduce((a, s) => a + (s.actual ?? 0), 0);
  const rangePredicted = shown.reduce((a, s) => a + (s.predicted ?? 0), 0);
  const flagged = d.claims.filter((c) => ['flagged', 'evidence_requested', 'rejected'].includes(c.status));
  return (
    <>
      <PageHeader eyebrow="Generator portal" title={d.plant.name} subtitle={`${d.plant.plant_id} · ${fmtNumber(d.plant.capacity_mw, 1)} MW ${d.plant.energy_type} · ${d.plant.location}`} actions={<><StatusBadge status={d.today.status} /><Link className="btn btn-primary btn-sm" to={ROUTES.generator.submit}>Upload Generation Data</Link></>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Today's generation" value={fmtEnergy(d.today.generation_kwh)} hint={d.today.date ? `Metered ${fmtDate(d.today.date)}` : undefined} tone="primary" />
        <KpiCard label="AI expected" value={fmtEnergy(d.today.expected?.predicted_kwh)} hint={d.today.expected ? `Range ${fmtEnergy(d.today.expected.lower)} – ${fmtEnergy(d.today.expected.upper)}` : undefined} />
        <KpiCard label="Deviation" value={fmtPct(d.today.deviation_pct, 1, true)} hint="Metered vs AI expected" tone={tone} />
        <KpiCard label="Status" value={d.today.status} hint={d.today.status === 'NORMAL' ? 'Within ±15% of expectation' : d.today.status === 'WATCH' ? 'Between 15% and 40% off expectation' : d.today.status === 'ANOMALY' ? 'More than 40% off expectation' : 'No metered data yet'} tone={tone} />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <ChartCard title={range === 'today' ? 'Today' : range === '7d' ? 'Last 7 days' : 'Last 30 days'} subtitle="Metered vs AI predicted (shaded: 10–90% interval)" legend={[{ label: 'Actual', color: chartColor.actual }, { label: 'AI predicted', color: chartColor.expected, dashed: true }]}
          actions={<div className="flex gap-1" role="tablist" aria-label="Range">{(['today', '7d', '30d'] as Range[]).map((r) => <button key={r} type="button" role="tab" aria-selected={range === r} className={cn('btn btn-sm', range === r ? 'btn-primary' : 'btn-ghost')} onClick={() => setRange(r)}>{r === 'today' ? 'Today' : r === '7d' ? '7 days' : '30 days'}</button>)}</div>}>
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1"><LineChart data={shown} xKey="date" series={[{ key: 'actual', label: 'Actual', color: chartColor.actual }, { key: 'predicted', label: 'AI predicted', color: chartColor.expected, dashed: true }]} band={{ lowKey: 'lower', highKey: 'upper' }} yFormatter={(v) => fmtEnergy(v)} xFormatter={(x) => x.slice(5)} /></div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-2 text-xs text-ink-2" data-testid="range-summary"><span>Metered <b className="num">{fmtEnergy(rangeActual)}</b></span><span>AI expected <b className="num">{fmtEnergy(rangePredicted)}</b></span><span>{shown.length} day(s)</span></div>
          </div>
        </ChartCard>
        <Panel title="Forecast" subtitle="Next 24 / 48 / 72 hours" actions={<Link className="btn btn-ghost btn-sm" to={ROUTES.generator.forecast}>Details</Link>}>
          <ul className="space-y-2">{d.forecast.map((f) => <li key={f.horizon_hours} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"><span>Next {f.horizon_hours} hours<span className="block text-[11px] text-ink-3">{fmtDate(f.target_date)}</span></span><span className="num text-right font-semibold">{fmtEnergy(f.predicted_kwh)}<span className="block text-[11px] font-normal text-ink-3">{fmtEnergy(f.lower_bound_kwh)} – {fmtEnergy(f.upper_bound_kwh)}</span></span></li>)}</ul>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <WeatherCard weather={d.weather} date={d.today.date} />
        <Panel title="Claims on my generation" subtitle={`${d.claims.length} claim(s) · ${flagged.length} flagged or rejected`} actions={<Link className="btn btn-ghost btn-sm" to={ROUTES.generator.claims}>All claims</Link>} padded={false}>
          <ul className="divide-y divide-line text-sm" data-testid="my-claims">
            {d.claims.slice(0, 5).map((c) => <li key={c.claim_id} className="flex items-center gap-3 px-4 py-2"><span className="font-mono font-semibold">{c.claim_id}</span><span className="min-w-0 flex-1 truncate text-ink-2">{c.institution_id} · {fmtEnergy(c.claimed_kwh)}</span><RiskBadge score={c.risk_score} level={c.risk_level} /><StatusBadge status={c.status} kind="claim" /></li>)}
            {d.claims.length === 0 && <li className="px-4 py-3 text-ink-3">No claims yet against this plant.</li>}
          </ul>
        </Panel>
      </div>
    </>
  );
}
