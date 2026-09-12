import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TimelineItem { id: string | number; time: ReactNode; title: ReactNode; detail?: ReactNode; actor?: ReactNode; tone?: 'low' | 'medium' | 'high' | 'critical' | 'info' | 'neutral'; meta?: ReactNode; }
const dot: Record<NonNullable<TimelineItem['tone']>, string> = { low: 'bg-low', medium: 'bg-medium', high: 'bg-high', critical: 'bg-critical', info: 'bg-info', neutral: 'bg-line-strong' };

export function Timeline({ items, compact }: { items: TimelineItem[]; compact?: boolean }) {
  if (items.length === 0) return <p className="text-sm text-ink-3">No events yet.</p>;
  return (
    <ol className="relative ml-2 border-l border-line">
      {items.map((it) => (
        <li key={it.id} className={cn('relative pl-5', compact ? 'pb-3' : 'pb-5', 'last:pb-0')}>
          <span className={cn('absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface', dot[it.tone ?? 'info'])} />
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="num font-mono text-[11px] text-ink-3">{it.time}</span>
            <span className="text-sm font-semibold">{it.title}</span>
            {it.actor && <span className="text-xs text-ink-3">· {it.actor}</span>}
          </div>
          {it.detail && <div className="mt-0.5 text-xs text-ink-2">{it.detail}</div>}
          {it.meta && <div className="mt-1 font-mono text-[11px] text-ink-3">{it.meta}</div>}
        </li>
      ))}
    </ol>
  );
}
