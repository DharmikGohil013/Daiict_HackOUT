import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import type { ApiError } from '@/types';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="flex items-center gap-2 py-6 text-sm text-ink-3"><Loader2 size={16} className="animate-spin" />{label}</div>;
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
