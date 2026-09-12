import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePlant } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { KpiCard } from '@/components/common/KpiCard';
import { Kv } from '@/components/common/Kv';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RiskBadge } from '@/components/common/RiskBadge';
import { DataTable } from '@/components/common/DataTable';
import { ChartCard } from '@/components/charts/ChartCard';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { chartColor } from '@/components/charts/palette';
import { WeatherCard } from '@/components/dashboard/WeatherCard';
import { fmtDate, fmtEnergy, fmtNumber } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import type { Claim } from '@/types';
import { useAuth } from '@/lib/auth';

export function PlantProfileView({ plantId, backTo }: { plantId: string; backTo?: { to: string; label: string } }) {
  const q = usePlant(plantId);
  const navigate = useNavigate();
  const role = useAuth((s) => s.user?.role);
  if (q.isLoading) return <LoadingState label="Loading plant profile…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { plant, kpis, series, monthly_generation, anomalies, weather } = q.data;
  const claimRoute = (c: Claim) => (role === 'generator' ? undefined : navigate(ROUTES.government.claim(c.claim_id)));
  return (
    <>
      <PageHeader eyebrow={backTo ? <Link to={backTo.to}>← {backTo.label}</Link> : 'Plant profile'} title={plant.name} subtitle={`${plant.plant_id} · ${plant.energy_type} · ${fmtNumber(plant.capacity_mw, 1)} MW · ${plant.location}`} actions={<StatusBadge status={plant.status} kind="plant" />} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total generation" value={fmtEnergy(kpis.total_generation_kwh)} hint={`${kpis.generation_days} metered days`} tone="primary" />
        <KpiCard label="Average daily" value={fmtEnergy(kpis.avg_daily_kwh)} hint={kpis.capacity_factor_pct != null ? `capacity factor ${fmtNumber(kpis.capacity_factor_pct, 1)}%` : undefined} />
        <KpiCard label="Total claims" value={kpis.total_claims} />
        <KpiCard label="Flagged claims" value={kpis.flagged_claims} tone={kpis.flagged_claims ? 'high' : 'low'} />
        <KpiCard label="Average risk" value={fmtNumber(kpis.avg_risk, 0)} tone={kpis.avg_risk > 60 ? 'critical' : kpis.avg_risk > 30 ? 'medium' : 'low'} />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <ChartCard title="Actual vs AI predicted" subtitle="Daily generation, last 60 days" legend={[{ label: 'Actual', color: chartColor.actual }, { label: 'AI predicted', color: chartColor.expected, dashed: true }]}>
          <LineChart data={series.map((s) => ({ date: s.date, actual: s.actual_kwh, predicted: s.predicted_kwh, lower: s.lower, upper: s.upper }))} xKey="date" series={[{ key: 'actual', label: 'Actual', color: chartColor.actual }, { key: 'predicted', label: 'AI predicted', color: chartColor.expected, dashed: true }]} band={{ lowKey: 'lower', highKey: 'upper' }} yFormatter={(v) => fmtEnergy(v)} xFormatter={(d) => d.slice(5)} />
        </ChartCard>
        <Panel title="Registration">
          <Kv cols={1} items={[{ label: 'Plant ID', value: plant.plant_id, mono: true }, { label: 'Energy type', value: plant.energy_type }, { label: 'Installed capacity', value: `${fmtNumber(plant.capacity_mw, 1)} MW` }, { label: 'Location', value: `${plant.location}${plant.latitude ? ` (${plant.latitude}, ${plant.longitude})` : ''}` }, { label: 'Registered', value: fmtDate(plant.registered_at) }, { label: 'Operator', value: plant.operator_email ?? '—' }]} />
        </Panel>
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly generation" legend={[{ label: 'kWh', color: chartColor.primary }]}>
          <BarChart data={monthly_generation} xKey="month" series={[{ key: 'kwh', label: 'Generation', color: chartColor.primary }]} yFormatter={(v) => fmtEnergy(v)} />
        </ChartCard>
        <ChartCard title="Weather vs generation" subtitle="Irradiance / wind against metered output" legend={[{ label: 'Actual', color: chartColor.actual }, { label: plant.energy_type === 'Wind' ? 'Wind m/s ×1000' : 'Irradiance ×5000', color: chartColor.accent, dashed: true }]}>
          <LineChart data={series.map((s) => ({ date: s.date, actual: s.actual_kwh, w: plant.energy_type === 'Wind' ? (s.wind_speed_ms ?? 0) * 1000 : (s.solar_irradiance_kwh_m2 ?? 0) * 5000 }))} xKey="date" series={[{ key: 'actual', label: 'Actual', color: chartColor.actual }, { key: 'w', label: 'Weather', color: chartColor.accent, dashed: true }]} yFormatter={(v) => fmtEnergy(v)} xFormatter={(d) => d.slice(5)} />
        </ChartCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <WeatherCard weather={weather} date={series[series.length - 1]?.date} />
        <Panel title="Anomalies" subtitle="Claims on this plant that were flagged or rejected" padded={false}>
          <DataTable dense rows={anomalies} rowKey={(c) => c.claim_id} onRowClick={role === 'generator' ? undefined : claimRoute} emptyText="No anomalies recorded." columns={[
            { key: 'claim_id', header: 'Claim', render: (c) => <span className="font-mono">{c.claim_id}</span> },
            { key: 'inst', header: 'Institution', render: (c) => c.institution_id },
            { key: 'claimed', header: 'Claimed', align: 'right', render: (c) => fmtEnergy(c.claimed_kwh) },
            { key: 'expected', header: 'Expected', align: 'right', render: (c) => fmtEnergy(c.expected_kwh) },
            { key: 'risk', header: 'Risk', render: (c) => <RiskBadge score={c.risk_score} level={c.risk_level} /> },
            { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} kind="claim" /> },
          ]} />
        </Panel>
      </div>
    </>
  );
}

export default function PlantProfilePage() {
  const { id } = useParams();
  return <PlantProfileView plantId={id!} backTo={{ to: ROUTES.government.plants, label: 'Plants' }} />;
}
