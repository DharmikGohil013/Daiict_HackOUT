import { Panel } from '@/components/common/Panel';
import { fmtEnergy, fmtPct } from '@/lib/format';
import { cn } from '@/lib/cn';

/** FinalMD §42 — the most important visual: Claimed vs AI Expected vs Actual as horizontal bars. */
export function EnergyComparisonCard({ claimed, expected, actual, range, title = 'Claimed vs AI Expected vs Actual', compact, unitDigits }: { claimed: number; expected: number | null | undefined; actual: number | null | undefined; range?: { lower: number | null | undefined; upper: number | null | undefined }; title?: string; compact?: boolean; unitDigits?: number }) {
  const max = Math.max(claimed, expected ?? 0, actual ?? 0, 1);
  const rows: Array<{ label: string; value: number | null | undefined; color: string; note?: string }> = [
    { label: 'CLAIMED', value: claimed, color: 'bg-critical' },
    { label: 'AI EXPECTED', value: expected, color: 'bg-primary', note: range?.lower != null && range?.upper != null ? `range ${fmtEnergy(range.lower, { digits: unitDigits })} – ${fmtEnergy(range.upper, { digits: unitDigits })}` : undefined },
    { label: 'ACTUAL', value: actual, color: 'bg-low' },
  ];
  const devExpected = expected ? ((claimed - expected) / expected) * 100 : null;
  const devActual = actual ? ((claimed - actual) / actual) * 100 : null;
  const body = (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[92px_1fr_auto] items-center gap-3">
          <span className="label">{r.label}</span>
          <div className="h-6 w-full overflow-hidden rounded bg-surface-2">
            {r.value != null && <div className={cn('h-full rounded transition-[width]', r.color)} style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />}
          </div>
          <span className="num min-w-[88px] text-right text-sm font-semibold">{fmtEnergy(r.value, { digits: unitDigits })}{r.note && <span className="block text-[10px] font-normal text-ink-3">{r.note}</span>}</span>
        </div>
      ))}
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-xs text-ink-2">
        {devExpected != null && <span>vs expected <b className={cn('num', devExpected > 15 ? 'text-critical' : 'text-low')}>{fmtPct(devExpected, 1, true)}</b></span>}
        {devActual != null && <span>vs actual <b className={cn('num', devActual > 15 ? 'text-critical' : 'text-low')}>{fmtPct(devActual, 1, true)}</b></span>}
        {expected != null && actual != null && <span>difference claimed − actual <b className="num">{fmtEnergy(claimed - actual, { digits: unitDigits })}</b></span>}
      </div>
    </div>
  );
  return compact ? body : <Panel title={title}>{body}</Panel>;
}
