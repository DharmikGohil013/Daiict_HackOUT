import { useForecast, useGeneratorDashboard } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard } from '@/components/common/KpiCard';
import { ErrorState, LoadingState } from '@/components/common/States';
import { ChartCard } from '@/components/charts/ChartCard';
import { LineChart } from '@/components/charts/LineChart';
import { chartColor } from '@/components/charts/palette';
import { fmtEnergy } from '@/lib/format';

export default function ForecastPage() {
  const plantId = useAuth((s) => s.user?.entity_id);
  const f = useForecast(plantId);
  const d = useGeneratorDashboard(plantId);
  if (f.isLoading || d.isLoading) return <LoadingState label="Forecasting…" />;
  if (f.isError || !f.data) return <ErrorState error={f.error} retry={() => f.refetch()} />;
  const fc = f.data.forecast;
  const history = (d.data?.series_30d ?? []).slice(-14).map((s) => ({ date: s.date, actual: s.actual_kwh, predicted: s.predicted_kwh, lower: s.lower, upper: s.upper }));
  const data = [...history, ...fc.map((x) => ({ date: x.target_date, actual: null, predicted: x.predicted_kwh, lower: x.lower_bound_kwh, upper: x.upper_bound_kwh }))];
  return (
    <>
      <PageHeader eyebrow="Generator portal" title="Generation forecast" subtitle="Weather-driven expectation from the same model the government uses to verify claims." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {fc.map((x) => <KpiCard key={x.horizon_hours} label={`Next ${x.horizon_hours} hours`} value={fmtEnergy(x.predicted_kwh)} hint={`Expected range ${fmtEnergy(x.lower_bound_kwh)} – ${fmtEnergy(x.upper_bound_kwh)} · ${x.target_date}`} tone="primary" />)}
      </div>
      <ChartCard title="Recent actual and forecast" legend={[{ label: 'Actual', color: chartColor.actual }, { label: 'Forecast', color: chartColor.expected, dashed: true }]}>
        <LineChart data={data} xKey="date" series={[{ key: 'actual', label: 'Actual', color: chartColor.actual }, { key: 'predicted', label: 'Forecast', color: chartColor.expected, dashed: true }]} band={{ lowKey: 'lower', highKey: 'upper' }} yFormatter={(v) => fmtEnergy(v)} xFormatter={(x) => x.slice(5)} />
      </ChartCard>
    </>
  );
}
