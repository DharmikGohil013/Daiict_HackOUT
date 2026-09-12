import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Panel } from '@/components/common/Panel';
import { EvidenceCard } from '@/components/fraud/EvidenceCard';
import { EnergyComparisonCard } from '@/components/claims/EnergyComparisonCard';
import { FilterBar, Select } from '@/components/common/FilterBar';
import { KpiCard } from '@/components/common/KpiCard';
import { http, API_BASE } from '@/services/api/client';
import { useToast } from '@/components/common/Toast';
import { fmtDate, fmtEnergy, fmtNumber } from '@/lib/format';
import { Check, X, Brain, Factory, Cloud, Eye, Sparkles } from 'lucide-react';
import type { ApiError } from '@/types';

// Fetch generation data with filters
const useOfficerGeneration = (status: string, plantId: string) => useQuery({
  queryKey: ['officer', 'generation', status, plantId],
  queryFn: async () => {
    const res = await http.get<{ success: boolean; rows: any[]; stats: any; plants: any[] }>('/officer/generation', { params: { status, plant_id: plantId } });
    return res.data;
  }
});

// Approve generation
const useApproveGeneration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await http.post<{ success: boolean; cert_id: string; download_url: string }>('/officer/approve_generation', { id });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['officer', 'generation'] });
    }
  });
};

// Decline generation
const useDeclineGeneration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await http.post<{ success: boolean }>('/officer/decline_generation', { id });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['officer', 'generation'] });
    }
  });
};

export default function ApprovalsPage() {
  const [status, setStatus] = useState('pending');
  const [plantId, setPlantId] = useState('all');
  
  const q = useOfficerGeneration(status, plantId);
  const approve = useApproveGeneration();
  const decline = useDeclineGeneration();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const handleApprove = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const res = await approve.mutateAsync(id);
      toast.success('Approved', `Certificate ${res.cert_id} generated.`);
      setSelectedId(null);
    } catch (err) {
      toast.error('Approval failed', (err as ApiError).message);
    }
  };

  const handleDecline = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await decline.mutateAsync(id);
      toast.success('Declined', 'Data has been rejected and plant flagged.');
      setSelectedId(null);
    } catch (err) {
      toast.error('Decline failed', (err as ApiError).message);
    }
  };

  const selected = q.data?.rows?.find(r => r.id === selectedId);

  if (selected) {
    const diff = selected.predicted_kwh != null ? Math.abs(selected.generation_kwh - selected.predicted_kwh) / selected.predicted_kwh : 0;
    const isFlag = diff > 0.15;
    
    return (
      <>
        <PageHeader 
          eyebrow={<button type="button" onClick={() => setSelectedId(null)} className="hover:underline cursor-pointer text-ink-3">← Back to Approvals</button>} 
          title={<>Pending Approval: <span className="font-mono text-ink-3">{selected.plant_id}</span></>}
          subtitle={`Submitted for ${fmtDate(selected.date)} via ${selected.source}`}
          actions={selected.status === 'pending' ? <>
            <button className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50 border-red-200" onClick={(e) => handleDecline(e, selected.id)} disabled={approve.isPending || decline.isPending}>
              <X size={14} className="mr-1"/> Reject & Flag
            </button>
            <button className="btn btn-primary btn-sm bg-green-600 hover:bg-green-700 text-white" onClick={(e) => handleApprove(e, selected.id)} disabled={approve.isPending || decline.isPending}>
              <Check size={14} className="mr-1"/> Approve & Issue
            </button>
          </> : undefined}
        />
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <EvidenceCard title="Generation Summary" icon={Factory} items={[
            { label: 'Generator', value: `${selected.plant_name}` },
            { label: 'Plant ID', value: selected.plant_id, mono: true },
            { label: 'Energy Type', value: selected.energy_type },
            { label: 'Date', value: fmtDate(selected.date) },
            { label: 'Reported Energy', value: fmtEnergy(selected.generation_kwh) },
            { label: 'Meter Reading', value: selected.meter_reading_kwh ? `${fmtNumber(selected.meter_reading_kwh)} kWh` : '—' },
            { label: 'Operating Hours', value: selected.operating_hours ? `${fmtNumber(selected.operating_hours, 1)} hrs` : '—' },
          ]} />
          
          <div className="lg:col-span-2">
            {selected.prediction ? (
              <EnergyComparisonCard 
                claimed={selected.generation_kwh} 
                expected={selected.prediction.predicted_kwh} 
                actual={null} 
                range={{ lower: selected.prediction.lower_bound_kwh, upper: selected.prediction.upper_bound_kwh }} 
              />
            ) : (
              <EvidenceCard title="AI Forecast Evidence" icon={Brain} tone="default" items={[
                { label: 'Expected Generation', value: 'No Forecast Available' },
                { label: 'Actual Reported', value: fmtEnergy(selected.generation_kwh) },
              ]} />
            )}
            
            {isFlag && (
              <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-900">
                <h4 className="font-bold mb-1 flex items-center gap-2">
                  <X size={16}/> Anomaly Detected
                </h4>
                <p className="text-sm">
                  Reported generation exceeds acceptable deviation thresholds (±15%) from the AI weather forecast. Flagging for review is recommended.
                </p>
              </div>
            )}
            {!isFlag && selected.prediction && (
              <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-900">
                <h4 className="font-bold mb-1 flex items-center gap-2">
                  <Check size={16}/> Consistent with Forecast
                </h4>
                <p className="text-sm">
                  Reported generation is within expected AI ranges. Safe to approve.
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <EvidenceCard title="Weather & Conditions" icon={Cloud} items={[
            { label: 'Irradiance', value: selected.weather?.solar_irradiance_kwh_m2 != null ? `${selected.weather.solar_irradiance_kwh_m2} kWh/m²` : '—' },
            { label: 'Wind Speed', value: selected.weather?.wind_speed_ms != null ? `${selected.weather.wind_speed_ms} m/s` : '—' },
            { label: 'Cloud Cover', value: selected.weather?.cloud_cover_pct != null ? `${selected.weather.cloud_cover_pct}%` : '—' },
            { label: 'Temperature', value: selected.weather?.temperature_c != null ? `${selected.weather.temperature_c}°C` : '—' },
          ]} />
          
          <EvidenceCard title="AI Model Details" icon={Brain} items={[
            { label: 'Model Version', value: selected.prediction?.model_version || '—', mono: true },
            { label: 'Lower Bound (95% CI)', value: selected.prediction?.lower_bound_kwh != null ? fmtEnergy(selected.prediction.lower_bound_kwh) : '—' },
            { label: 'Upper Bound (95% CI)', value: selected.prediction?.upper_bound_kwh != null ? fmtEnergy(selected.prediction.upper_bound_kwh) : '—' },
          ]} />
        </div>
      </>
    );
  }

  const stats = q.data?.stats;

  return (
    <>
      <PageHeader 
        eyebrow="Government portal" 
        title="Issuing Officer Approvals" 
        subtitle="Review generation meter readings and authorize REC issuance with AI fraud pre-validation." 
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Submissions Pending Review" value={stats?.pending ?? '—'} tone="medium" onClick={() => setStatus('pending')} />
        <KpiCard label="Approved & Issued" value={stats?.approved ?? '—'} tone="low" onClick={() => setStatus('approved')} />
        <KpiCard label="Declined / Returned" value={stats?.declined ?? '—'} tone="critical" onClick={() => setStatus('declined')} />
      </div>

      <FilterBar>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">Filter:</span>
          {['Pending', 'Approved', 'Declined', 'All'].map(s => (
            <button 
              key={s} 
              onClick={() => setStatus(s.toLowerCase())} 
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${status === s.toLowerCase() ? 'bg-teal-500/20 text-teal-300' : 'text-neutral-400 hover:text-neutral-200 hover:bg-surface-3'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <Select id="plant-filter" label="Plant" value={plantId} onChange={setPlantId} allLabel="All Plants" options={q.data?.plants ?? []} />
      </FilterBar>

      {q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <DataTable 
          rows={q.data?.rows ?? []} 
          rowKey={(r) => r.id} 
          loading={q.isLoading} 
          onRowClick={(r) => setSelectedId(r.id)}
          columns={[
            { key: 'sub_id', header: 'SUBMISSION ID', render: (r) => <span className="font-mono text-teal-500 font-semibold">SUB-{String(r.id).padStart(4, '0')}</span> },
            { key: 'plant', header: 'PLANT', render: (r) => (
              <div>
                <div className="font-medium">{r.plant_name}</div>
                <div className="text-[11px] text-neutral-400 font-mono">{r.plant_id}</div>
              </div>
            ) },
            { key: 'date', header: 'DATE RANGE', render: (r) => <span className="font-medium">{fmtDate(r.date)}</span> },
            { key: 'rows', header: 'ROWS / TYPE', render: (r) => <span className="text-sm">1 row(s) • <span className="capitalize">{r.source}</span></span> },
            { key: 'ai', header: 'AI PRE-CHECK', render: (r) => {
              if (r.predicted_kwh == null) return <span className="text-neutral-400 text-sm">No Forecast</span>;
              const diff = Math.abs(r.generation_kwh - r.predicted_kwh) / r.predicted_kwh;
              const isFlag = diff > 0.15; // 15% threshold for visual warning
              const pct = 100 - (diff * 100);
              return (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${
                  isFlag ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-teal-500/10 text-teal-300 border-teal-500/20"
                }`}>
                  <Sparkles size={12} />
                  {isFlag ? 'High Deviation' : 'Likely Genuine'} ({Math.min(100, Math.max(0, pct)).toFixed(0)}%)
                </div>
              );
            }},
            { key: 'status', header: 'STATUS', render: (r) => (
               <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                 r.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                 r.status === 'declined' ? 'bg-red-500/10 text-red-400' :
                 'bg-yellow-500/10 text-yellow-400'
               }`}>
                 {r.status}
               </div>
            )},
            { key: 'actions', header: 'ACTION', align: 'right', render: (r) => (
              <div className="flex gap-2 justify-end items-center">
                <button 
                  className="p-1.5 text-neutral-400 hover:text-white hover:bg-surface-3 rounded transition-colors"
                  onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); }}
                  title="View Details"
                >
                  <Eye size={16} />
                </button>
                {r.status === 'pending' && (
                  <>
                    <button 
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-50"
                      onClick={(e) => handleApprove(e, r.id)}
                      disabled={approve.isPending || decline.isPending}
                    >
                      Approve
                    </button>
                    <button 
                      className="px-3 py-1.5 text-xs font-semibold rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      onClick={(e) => handleDecline(e, r.id)}
                      disabled={approve.isPending || decline.isPending}
                    >
                      Decline
                    </button>
                  </>
                )}
              </div>
            )}
          ]}
        />
      )}
    </>
  );
}
