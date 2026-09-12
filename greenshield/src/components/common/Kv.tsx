import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Label/value grid used for record summaries. */
export function Kv({ items, cols = 2, className }: { items: Array<{ label: ReactNode; value: ReactNode; mono?: boolean }>; cols?: 1 | 2 | 3 | 4; className?: string }) {
  const grid = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-2 md:grid-cols-3', 4: 'grid-cols-2 md:grid-cols-4' }[cols];
  return (
    <dl className={cn('grid gap-x-4 gap-y-3', grid, className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="label">{it.label}</dt>
          <dd className={cn('mt-0.5 break-words text-sm font-medium num', it.mono && 'font-mono text-xs')}>{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
