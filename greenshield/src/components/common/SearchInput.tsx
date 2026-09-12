import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export function SearchInput({ value, onChange, placeholder = 'Search…', className, id }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; id?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
      <input id={id} type="search" className="field pl-9 pr-8" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
      {value && <button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" onClick={() => onChange('')}><X size={14} /></button>}
    </div>
  );
}
