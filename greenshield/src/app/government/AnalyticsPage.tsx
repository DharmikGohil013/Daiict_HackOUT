import { useState } from 'react';
import { useAnalytics } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard } from '@/components/common/KpiCard';
import { FilterBar, Select } from '@/components/common/FilterBar';
import { ErrorState, LoadingState } from '@/components/common/States';
import { ChartCard } from '@/components/charts/ChartCard';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { chartColor } from '@/components/charts/palette';
import { Panel } from '@/components/common/Panel';
import { DataTable } from '@/components/common/DataTable';
import { RiskBadge } from '@/components/common/RiskBadge';
import { fmtEnergy, fmtNumber } from '@/lib/format';

export default function AnalyticsPage() {
  const [f, setF] = useState<{ date_from?: string; date_to?: string; energy_type?: string; state?: string }>({});
  const q = useAnalytics(f);
  return (
    <>
      <PageHeader eyebrow="Government portal" title="Analytics" subtitle="Generation, claims, verification outcomes and fraud signals over time." />
      <FilterBar>
        <label className="flex flex-col gap-1 text-xs"><span className="label">From</span><input type="date" className="field py-1.5 text-sm" value={f.date_from ?? ''} onChange={(e) => setF({ ...f, date_from: e.target.value || undefined })} /></label>
        <label className="flex flex-col gap-1 text-xs"><span className="label">To</span><input type="date" className="field py-1.5 text-sm" value={f.date_to ?? ''} onChange={(e) => setF({ ...f, date_to: e.target.value || undefined })} /></label>
        <Select id="a-energy" label="Energy type" value={f.energy_type ?? ''} onChange={(v) => setF({ ...f, energy_type: v || undefined })} allLabel="All" options={['Solar', 'Wind', 'Hydro', 'Biomass'].map((v) => ({ value: v, label: v }))} />
        <Select id="a-state" label="State" value={f.state ?? ''} onChange={(v) => setF({ ...f, state: v || undefined })} allLabel="All" options={(q.data?.states ?? []).map((s) => ({ value: s, label: s }))} />
      </FilterBar>
      {q.isLoading ? <LoadingState /> : q.isError || !q.data ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <KpiCard label="Claims" value={fmtNumber(q.data.total_claims)} />
            <KpiCard label="Verified energy" value={fmtEnergy(q.data.verified_energy_kwh)} tone="low" />
            <KpiCard label="Rejected energy" value={fmtEnergy(q.data.rejected_energy_kwh)} tone="critical" />
            <KpiCard label="Fraud detection rate" value={`${fmtNumber(q.data.fraud_detection_rate_pct, 1)}%`} tone="high" />
            <KpiCard label="Average fraud score" value={fmtNumber(q.data.avg_fraud_score, 1)} tone="medium" />
            <KpiCard label="Tampering / duplicates" value={`${q.data.certificate_tampering_attempts} / ${q.data.duplicate_claim_attempts}`} tone="critical" />
          </div>
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Renewable generation by month" legend={[{ label: 'Metered kWh', color: chartColor.primary }]}><BarChart data={q.data.generation_by_month} xKey="month" series={[{ key: 'kwh', label: 'Generation', color: chartColor.primary }]} yFormatter={(v) => fmtEnergy(v)} /></ChartCard>
            <ChartCard title="Claims by month" subtitle="Claimed vs AI expected vs actual" legend={[{ label: 'Claimed', color: chartColor.claimed }, { label: 'Expected', color: chartColor.expected }, { label: 'Actual', color: chartColor.actual }]}><LineChart data={q.data.claims_by_month} xKey="month" series={[{ key: 'claimed_kwh', label: 'Claimed', color: chartColor.claimed }, { key: 'expected_kwh', label: 'Expected', color: chartColor.expected }, { key: 'actual_kwh', label: 'Actual', color: chartColor.actual }]} yFormatter={(v) => fmtEnergy(v)} /></ChartCard>
            <ChartCard title="Claim deviation distribution" subtitle="Claimed vs AI expected"><BarChart data={q.data.deviation_distribution} xKey="bucket" series={[{ key: 'claims', label: 'Claims', color: chartColor.info }]} colorByRow={(r) => (String(r.bucket).startsWith('>') || String(r.bucket).startsWith('40') ? chartColor.critical : String(r.bucket).startsWith('15') ? chartColor.medium : chartColor.low)} /></ChartCard>
            <ChartCard title="Risk distribution"><DonutChart data={[{ name: 'Low', value: q.data.risk_distribution.LOW, color: chartColor.low }, { name: 'Medium', value: q.data.risk_distribution.MEDIUM, color: chartColor.medium }, { name: 'High', value: q.data.risk_distribution.HIGH, color: chartColor.high }, { name: 'Critical', value: q.data.risk_distribution.CRITICAL, color: chartColor.critical }]} centerLabel="claims" /></ChartCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Top suspicious generators" padded={false}><DataTable dense rows={q.data.top_suspicious_generators} rowKey={(r) => r.plant_id} columns={[{ key: 'id', header: 'Plant', render: (r) => <span>{r.plant_id}<span className="block text-[11px] text-ink-3">{r.name}</span></span> }, { key: 'claims', header: 'Claims', align: 'right', render: (r) => r.claims }, { key: 'flagged', header: 'Flagged', align: 'right', render: (r) => r.flagged }, { key: 'avg', header: 'Avg risk', render: (r) => <RiskBadge score={Math.round(r.avg_risk)} /> }]} /></Panel>
            <Panel title="Top suspicious institutions" padded={false}><DataTable dense rows={q.data.top_suspicious_institutions} rowKey={(r) => r.institution_id} columns={[{ key: 'id', header: 'Institution', render: (r) => <span>{r.institution_id}<span className="block text-[11px] text-ink-3">{r.name}</span></span> }, { key: 'claims', header: 'Claims', align: 'right', render: (r) => r.claims }, { key: 'dup', header: 'Dup / tamper', align: 'right', render: (r) => `${r.duplicates} / ${r.tampering}` }, { key: 'avg', header: 'Avg risk', render: (r) => <RiskBadge score={Math.round(r.avg_risk)} /> }]} /></Panel>
          </div>
        </>
      )}
    </>
  );
}
