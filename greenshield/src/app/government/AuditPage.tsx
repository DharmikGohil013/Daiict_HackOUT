import { useState } from 'react';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { useAudit } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { Timeline } from '@/components/common/Timeline';
import { SearchInput } from '@/components/common/SearchInput';
import { FilterBar } from '@/components/common/FilterBar';
import { ErrorState, LoadingState } from '@/components/common/States';
import { fmtDate, fmtNumber, fmtTime, shortHash } from '@/lib/format';

export default function AuditPage() {
  const [ref, setRef] = useState('');
  const filters = ref.startsWith('CLM') ? { claim_id: ref } : ref.startsWith('REC') ? { cert_id: ref } : ref.startsWith('TXN') ? { transaction_id: ref } : {};
  const q = useAudit({ ...filters, limit: 200 });
  return (
    <>
      <PageHeader eyebrow="Government portal" title="Tamper-evident audit trail" subtitle="Every verification step is hash-chained. Altering or deleting a past event breaks every hash after it." actions={q.data && (
        <span className={`chip ${q.data.chain.valid ? 'bg-low-soft text-low' : 'bg-critical-soft text-critical'}`}>{q.data.chain.valid ? <ShieldCheck size={12} /> : <ShieldX size={12} />}{q.data.chain.valid ? 'Chain intact' : `Chain broken at #${q.data.chain.broken_at_id}`} · {fmtNumber(q.data.chain.entries)} events</span>
      )} />
      <FilterBar><SearchInput className="w-80" value={ref} onChange={(v) => setRef(v.trim().toUpperCase())} placeholder="Filter by CLM-…, REC-… or TXN-…" /></FilterBar>
      {q.isLoading ? <LoadingState /> : q.isError || !q.data ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <Panel>
          <Timeline items={q.data.events.map((e) => ({ id: e.id, time: <>{fmtDate(e.timestamp)} {fmtTime(e.timestamp)}</>, title: e.action, actor: e.actor, detail: <>{e.detail}{(e.claim_id || e.cert_id || e.transaction_id) && <span className="ml-2 font-mono text-[11px] text-ink-3">{[e.transaction_id, e.claim_id, e.cert_id].filter(Boolean).join(' · ')}</span>}</>, meta: `entry ${shortHash(e.entry_hash, 10)} ← prev ${shortHash(e.prev_hash, 10)}${e.reference_hash ? ` · ref ${shortHash(e.reference_hash, 10)}` : ''}`, tone: /reject|blocked|MISMATCH|INVALID|NOT found|revoked/i.test(e.action) ? 'critical' : /approved|verified|issued|marked/i.test(e.action) ? 'low' : 'info' }))} />
        </Panel>
      )}
    </>
  );
}
