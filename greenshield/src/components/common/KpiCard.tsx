import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'default' | 'primary' | 'low' | 'medium' | 'high' | 'critical' | 'info';
const toneText: Record<Tone, string> = { default: 'text-ink', primary: 'text-primary', low: 'text-low', medium: 'text-medium', high: 'text-high', critical: 'text-critical', info: 'text-info' };
const toneBg: Record<Tone, string> = { default: 'bg-surface-2', primary: 'bg-primary-soft', low: 'bg-low-soft', medium: 'bg-medium-soft', high: 'bg-high-soft', critical: 'bg-critical-soft', info: 'bg-info-soft' };

export function KpiCard({ label, value, hint, tone = 'default', icon: Icon, onClick }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: LucideIcon; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cn('panel panel-pad flex items-start gap-3 text-left', onClick && 'hover:shadow-pop transition-shadow')}>
      {Icon && <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', toneBg[tone], toneText[tone])}><Icon size={18} /></span>}
      <div className="min-w-0">
        <div className="label">{label}</div>
        <div className={cn('num mt-1 font-display text-2xl font-semibold leading-none', toneText[tone])}>{value}</div>
        {hint && <div className="mt-1.5 text-xs text-ink-3">{hint}</div>}
      </div>
    </Tag>
  );
}
