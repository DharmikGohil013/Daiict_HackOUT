import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import type { ApiError } from '@/types';

export function LoadingState({ label = 'Loading…', compact = false }: { label?: string; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-ink-3">
        <Loader2 size={14} className="animate-spin text-primary" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3.5 py-12 text-center" role="status" aria-label={label}>
      <div className="relative grid h-12 w-12 place-items-center">
        <span className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping opacity-50" />
        <span className="absolute inset-0 rounded-full border-2 border-primary/30" />
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-semibold text-ink animate-pulse">{label}</div>
        <div className="text-xs text-ink-3">Querying cryptographic ledger &amp; AI models…</div>
      </div>
      <div className="mt-2 flex w-full max-w-xs flex-col gap-2 opacity-50" aria-hidden="true">
        <div className="h-2 w-full rounded-full bg-surface-3 animate-pulse" />
        <div className="h-2 w-2/3 self-center rounded-full bg-surface-3 animate-pulse" />
      </div>
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', detail, action }: { title?: string; detail?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Inbox size={28} className="text-ink-3" />
      <div className="text-sm font-semibold">{title}</div>
      {detail && <div className="max-w-sm text-xs text-ink-3">{detail}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const e = error as ApiError | undefined;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-critical/40 bg-critical-soft px-4 py-3 text-sm">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-critical" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-critical">{e?.status ? `Request failed (${e.status})` : 'Could not reach the GreenShield API'}</div>
        <div className="mt-0.5 text-xs text-ink-2">{e?.message}{e?.details?.length ? ` — ${e.details.join(' ')}` : ''}</div>
      </div>
      {retry && <button type="button" className="btn btn-secondary btn-sm" onClick={retry}>Retry</button>}
    </div>
  );
}
