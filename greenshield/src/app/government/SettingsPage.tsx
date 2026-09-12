import { useEffect, useState, type FormEvent } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { useModelInfo, useResetRiskSettings, useRiskSettings, useUpdateRiskSettings } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { Kv } from '@/components/common/Kv';
import { Field } from '@/components/common/FilterBar';
import { ErrorState, LoadingState } from '@/components/common/States';
import { useToast } from '@/components/common/Toast';
import { API_BASE, MOCK_API } from '@/services/api/client';
import { useAuth } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { RiskSettings } from '@/services/api/settings';
import type { ApiError } from '@/types';

const WEIGHTS: Array<{ key: keyof RiskSettings['weights']; label: string; hint: string }> = [
  { key: 'generation', label: 'Generation deviation', hint: 'claimed vs AI-expected generation' },
  { key: 'historical', label: 'Historical anomaly', hint: "claimed vs the plant's own recent history" },
  { key: 'weather', label: 'Weather inconsistency', hint: 'weather-adjusted expectation vs claim' },
  { key: 'certificate', label: 'Certificate anomaly', hint: 'crypto / ledger / claim-state result' },
  { key: 'capacity', label: 'Capacity consistency', hint: 'claimed vs metered actual and physical limits' },
];

export default function SettingsPage() {
  const model = useModelInfo();
  const settings = useRiskSettings();
  const update = useUpdateRiskSettings();
  const reset = useResetRiskSettings();
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const [form, setForm] = useState<Pick<RiskSettings, 'thresholds' | 'weights' | 'auto_verify_max_level'> | null>(null);
  useEffect(() => { if (settings.data && !form) setForm({ thresholds: settings.data.thresholds, weights: settings.data.weights, auto_verify_max_level: settings.data.auto_verify_max_level }); }, [settings.data, form]);

  const weightSum = form ? Object.values(form.weights).reduce((a, b) => a + b, 0) : 0;
  const thresholdsOk = !!form && form.thresholds.LOW < form.thresholds.MEDIUM && form.thresholds.MEDIUM < form.thresholds.HIGH && form.thresholds.HIGH < 100;
  const valid = !!form && weightSum === 100 && thresholdsOk;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || !valid) return;
    try {
      const r = await update.mutateAsync(form);
      setForm({ thresholds: r.thresholds, weights: r.weights, auto_verify_max_level: r.auto_verify_max_level });
      toast.success('Risk configuration saved', 'Applied to every new score and recorded in the audit trail.');
    } catch (err) { toast.error('Could not save', (err as ApiError).message); }
  };
  const doReset = async () => {
    try { const r = await reset.mutateAsync(); setForm({ thresholds: r.thresholds, weights: r.weights, auto_verify_max_level: r.auto_verify_max_level }); toast.success('Defaults restored'); }
    catch (err) { toast.error('Could not reset', (err as ApiError).message); }
  };
  const setT = (k: 'LOW' | 'MEDIUM' | 'HIGH', v: string) => form && setForm({ ...form, thresholds: { ...form.thresholds, [k]: Number(v) } });
  const setW = (k: keyof RiskSettings['weights'], v: string) => form && setForm({ ...form, weights: { ...form.weights, [k]: Number(v) } });

  return (
    <>
      <PageHeader eyebrow="Government portal" title="Settings" subtitle="Environment, generation model and the risk engine's thresholds and weights." />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Session"><Kv cols={1} items={[{ label: 'Signed in as', value: user?.email }, { label: 'Role', value: user?.role }, { label: 'Organisation', value: user?.organisation ?? '—' }, { label: 'API base', value: API_BASE || '(same origin)', mono: true }, { label: 'Data source', value: MOCK_API ? 'Sample data (mock mode)' : 'Live backend' }]} /></Panel>
        <Panel title="Generation model"><Kv cols={1} items={[{ label: 'Version', value: model.data?.model.version ?? '…' }, { label: 'Algorithm', value: model.data?.model.algorithm ?? '…' }, { label: 'Hold-out R²', value: String(model.data?.model.metrics?.r2 ?? '…') }, { label: 'MAPE', value: model.data?.model.metrics?.mape_pct != null ? `${model.data.model.metrics.mape_pct}%` : '…' }]} /></Panel>
      </div>
      <Panel title="Risk engine configuration" subtitle="Score = generation + historical + weather + certificate + capacity (weights sum to 100). Levels: LOW ≤ low threshold, MEDIUM ≤ medium, HIGH ≤ high, otherwise CRITICAL." actions={settings.data?.updated_at ? <span className="text-xs text-ink-3">Last changed {fmtDateTime(settings.data.updated_at)} by {settings.data.updated_by}</span> : <span className="text-xs text-ink-3">Environment defaults</span>}>
        {settings.isLoading || !form ? (settings.isError ? <ErrorState error={settings.error} retry={() => settings.refetch()} /> : <LoadingState />) : (
          <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_1fr]" data-testid="risk-settings-form">
            <div>
              <div className="label mb-2">Risk level thresholds (upper bound of each level)</div>
              <div className="grid grid-cols-3 gap-3">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((k) => (
                  <Field key={k} id={`t-${k}`} label={k}><input id={`t-${k}`} type="number" min="0" max="99" className="field num" value={form.thresholds[k]} onChange={(e) => setT(k, e.target.value)} /></Field>
                ))}
              </div>
              {!thresholdsOk && <p className="mt-1 text-xs text-critical">Thresholds must increase: LOW &lt; MEDIUM &lt; HIGH &lt; 100.</p>}
              <div className="mt-4">
                <Field id="auto-verify" label="Auto-verify claims up to" hint="Claims at or below this level with an authentic, unclaimed certificate are verified without government review"><select id="auto-verify" className="field" value={form.auto_verify_max_level} onChange={(e) => setForm({ ...form, auto_verify_max_level: e.target.value as RiskSettings['auto_verify_max_level'] })}><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option></select></Field>
              </div>
            </div>
            <div>
              <div className="label mb-2">Component weights <span className={cn('ml-2 num', weightSum === 100 ? 'text-low' : 'text-critical')}>{weightSum} / 100</span></div>
              <div className="space-y-2">
                {WEIGHTS.map((w) => (
                  <label key={w.key} htmlFor={`w-${w.key}`} className="grid grid-cols-[1fr_88px] items-center gap-3 text-sm">
                    <span>{w.label}<span className="block text-[11px] text-ink-3">{w.hint}</span></span>
                    <input id={`w-${w.key}`} type="number" min="0" max="100" className="field num py-1.5" value={form.weights[w.key]} onChange={(e) => setW(w.key, e.target.value)} />
                  </label>
                ))}
              </div>
              {weightSum !== 100 && <p className="mt-1 text-xs text-critical">Weights must sum to exactly 100.</p>}
            </div>
            <div className="flex flex-wrap gap-2 lg:col-span-2">
              <button type="submit" className="btn btn-primary" disabled={!valid || update.isPending}><Save size={14} /> {update.isPending ? 'Saving…' : 'Save configuration'}</button>
              <button type="button" className="btn btn-secondary" onClick={doReset} disabled={reset.isPending}><RotateCcw size={14} /> Reset to defaults</button>
              <span className="self-center text-xs text-ink-3">Changes apply to every new claim score; existing scores are not recomputed.</span>
            </div>
          </form>
        )}
      </Panel>
    </>
  );
}
