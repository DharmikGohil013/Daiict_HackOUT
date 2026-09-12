import type { RiskLevel } from '@/types';
import { cn } from '@/lib/cn';
import { levelForScore } from '@/lib/risk';

const cls: Record<RiskLevel, string> = { LOW: 'bg-low-soft text-low', MEDIUM: 'bg-medium-soft text-medium', HIGH: 'bg-high-soft text-high', CRITICAL: 'bg-critical-soft text-critical' };
const dot: Record<RiskLevel, string> = { LOW: 'bg-low', MEDIUM: 'bg-medium', HIGH: 'bg-high', CRITICAL: 'bg-critical' };

export function RiskLevelBadge({ level, className }: { level: RiskLevel | null | undefined; className?: string }) {
  if (!level) return <span className={cn('chip bg-surface-2 text-ink-3', className)}>Unscored</span>;
  return <span className={cn('chip', cls[level], className)}><span className={cn('h-1.5 w-1.5 rounded-full', dot[level])} />{level}</span>;
}

/** Score + level, e.g. "92 / 100 · CRITICAL". */
export function RiskBadge({ score, level, size = 'sm', className }: { score: number | null | undefined; level?: RiskLevel | null; size?: 'sm' | 'lg'; className?: string }) {
  if (score === null || score === undefined) return <RiskLevelBadge level={null} className={className} />;
  const lvl = level ?? levelForScore(score);
  if (size === 'lg') {
    return (
      <div className={cn('inline-flex items-baseline gap-2 rounded-xl px-3 py-1.5', cls[lvl], className)}>
        <span className="num font-display text-3xl font-semibold leading-none">{score}</span>
        <span className="text-xs font-semibold opacity-80">/ 100</span>
        <span className="ml-1 text-xs font-bold tracking-wide">{lvl} RISK</span>
      </div>
    );
  }
  return <span className={cn('chip', cls[lvl], className)}><span className="num">{score}</span><span className="opacity-70">·</span>{lvl}</span>;
}
