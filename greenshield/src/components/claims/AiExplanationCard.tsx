import { CheckCircle2 } from 'lucide-react';
import type { FraudScore } from '@/types';
import { Panel } from '@/components/common/Panel';
import { cn } from '@/lib/cn';

const sevCls: Record<string, string> = { HIGH: 'bg-critical-soft text-critical', MEDIUM: 'bg-medium-soft text-medium', LOW: 'bg-info-soft text-info', OK: 'bg-low-soft text-low' };
const COMPONENT_LABEL: Record<keyof FraudScore['components'], string> = { generation: 'Generation deviation', historical: 'Historical anomaly', weather: 'Weather inconsistency', certificate: 'Certificate anomaly', capacity: 'Capacity consistency' };

/** FinalMD §17 — "Why was this claim flagged?" with checks, findings and the transparent risk contribution. */
export function AiExplanationCard({ score, title = 'Why was this claim flagged?' }: { score: FraudScore; title?: string }) {
  const weights = score.weights ?? { generation: 40, historical: 20, weather: 20, certificate: 10, capacity: 10 };
  return (
    <Panel title={title} subtitle="Rule engine + AI engine + crypto engine, combined into one transparent score">
      <ul className="mb-4 grid gap-1 text-xs text-ink-2 sm:grid-cols-2">
        {score.checks.map((c) => <li key={c} className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} className="text-low" />{c}</li>)}
      </ul>
      <ol className="space-y-2">
        {score.findings.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={cn('chip mt-0.5 w-16 justify-center', sevCls[f.severity] ?? sevCls.LOW)}>{f.severity}</span>
            <span className="text-ink">{f.text}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5 space-y-2 border-t border-line pt-4">
        <div className="label">Risk contribution</div>
        {(Object.keys(COMPONENT_LABEL) as Array<keyof FraudScore['components']>).map((k) => {
          const v = score.components[k], w = weights[k];
          return (
            <div key={k} className="grid grid-cols-[170px_1fr_64px] items-center gap-3 text-sm">
              <span className="text-ink-2">{COMPONENT_LABEL[k]}</span>
              <div className="h-2 rounded bg-surface-2"><div className={cn('h-2 rounded', v / w > 0.7 ? 'bg-critical' : v / w > 0.35 ? 'bg-medium' : 'bg-low')} style={{ width: `${Math.min(100, (v / Math.max(w, 1)) * 100)}%` }} /></div>
              <span className="num text-right font-semibold">{v} / {w}</span>
            </div>
          );
        })}
        <div className="grid grid-cols-[170px_1fr_64px] items-center gap-3 border-t border-line pt-2 text-sm font-bold"><span>TOTAL</span><span /><span className="num text-right">{score.total} / 100</span></div>
      </div>
    </Panel>
  );
}
