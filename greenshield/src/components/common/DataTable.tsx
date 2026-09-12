import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { LoadingState } from './States';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, loading, emptyText = 'No records match.', dense, initialSort, footer }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; onRowClick?: (row: T) => void; loading?: boolean; emptyText?: ReactNode; dense?: boolean;
  initialSort?: { key: string; dir: 'asc' | 'desc' }; footer?: ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = sv(a), vb = sv(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const r = va < vb ? -1 : 1;
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, sort, columns]);

  const toggle = (c: Column<T>) => {
    if (!c.sortValue) return;
    setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'desc' }));
  };
  const pad = dense ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <div className="table-wrap">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-2 text-left">
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width }} className={cn('label whitespace-nowrap border-b border-line font-semibold', pad, c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.sortValue && 'cursor-pointer select-none hover:text-ink')} onClick={() => toggle(c)}>
                <span className="inline-flex items-center gap-1">
                  {c.header}
                  {c.sortValue && (sort?.key === c.key ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center"><LoadingState label="Loading…" /></td></tr>
          ) : sorted.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-ink-3">{emptyText}</td></tr>
          ) : sorted.map((row) => (
            <tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn('border-b border-line last:border-0', onRowClick && 'cursor-pointer hover:bg-surface-2/70 focus-within:bg-surface-2/70')} tabIndex={onRowClick ? 0 : undefined} onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={cn(pad, 'align-middle num', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot><tr><td colSpan={columns.length} className={cn(pad, 'border-t border-line text-xs text-ink-3')}>{footer}</td></tr></tfoot>}
      </table>
    </div>
  );
}
