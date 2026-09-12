import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Panel({ title, subtitle, actions, children, className, padded = true, tone }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean; tone?: 'default' | 'critical' | 'low' | 'medium' }) {
  const border = tone === 'critical' ? 'ring-1 ring-critical/50' : tone === 'low' ? 'ring-1 ring-low/50' : tone === 'medium' ? 'ring-1 ring-medium/50' : '';
  return (
    <section className={cn('panel', border, className)}>
      {(title || actions) && (
        <header className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-line', padded ? 'px-5 py-3.5' : 'px-4 py-3')}>
          <div>
            {title && <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'panel-pad' : ''}>{children}</div>
    </section>
  );
}
