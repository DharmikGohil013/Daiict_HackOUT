import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-4 flex flex-wrap items-end gap-3', className)}>{children}</div>;
}

export function Select({ id, label, value, onChange, options, className, allLabel }: { id: string; label?: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; className?: string; allLabel?: string }) {
  return (
    <label className={cn('flex flex-col gap-1 text-xs text-ink-3', className)} htmlFor={id}>
      {label && <span className="label">{label}</span>}
      <select id={id} className="field py-1.5 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Field({ id, label, children, hint, error }: { id: string; label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {error ? <span className="text-xs text-critical">{error}</span> : hint ? <span className="text-xs text-ink-3">{hint}</span> : null}
    </div>
  );
}
