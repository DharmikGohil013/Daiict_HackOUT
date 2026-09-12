import { useState, type FormEvent } from 'react';
import { CheckCircle2, MinusCircle, ShieldCheck, ShieldX, XCircle, UploadCloud, Loader2 } from 'lucide-react';
import { useVerifyRec } from '@/lib/queries';
import { Panel } from '@/components/common/Panel';
import { Kv } from '@/components/common/Kv';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useToast } from '@/components/common/Toast';
import { fmtEnergy } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { ApiError } from '@/types';

export function ManualVerifier() {
  const verify = useVerifyRec();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try {
      const r = await verify.mutateAsync(file);
      toast({ title: r.final_result, description: r.headline, type: r.final_result === 'VALID' ? 'success' : 'error' });
    } catch (err) {
      toast({ title: 'Verification failed', description: (err as ApiError).message, type: 'error' });
    }
  };

  const r = verify.data;
  const good = r?.final_result === 'VALID';

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Panel title="Upload suspect REC">
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl2 border-2 border-dashed border-line px-4 py-8 text-center text-sm text-ink-2 hover:border-primary">
            <UploadCloud size={28} className="text-primary" />
            {file ? <span className="font-semibold text-ink">{file.name}</span> : <span>Choose a PNG or PDF certificate</span>}
            <input type="file" className="sr-only" accept=".png,.pdf,image/png,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Certificate file" />
          </label>
          <button className="btn btn-primary w-full" type="submit" disabled={!file || verify.isPending}>
            {verify.isPending ? <><Loader2 size={16} className="animate-spin" /><span>Verifying certificate…</span></> : 'Verify certificate'}
          </button>
          <p className="text-xs text-ink-3">The file is analysed on the server and deleted afterwards; every attempt is written to the audit log.</p>
        </form>
      </Panel>
      <div className="space-y-4">
        {verify.isPending && (
          <div className="panel panel-pad border border-primary/30 bg-primary-soft/30 space-y-3" role="status">
            <div className="flex items-center gap-3">
              <Loader2 size={22} className="animate-spin text-primary" />
              <div>
                <div className="font-semibold text-ink">Analyzing Certificate File…</div>
                <div className="text-xs text-ink-3">Extracting LSB steganography, checking RSA-2048 signature, and querying ledger</div>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-primary animate-top-indeterminate" />
            </div>
          </div>
        )}
        {r && (
          <div className={cn('flex items-center gap-3 rounded-xl2 px-5 py-4', good ? 'bg-low-soft text-low' : 'bg-critical-soft text-critical')}>
            {good ? <ShieldCheck size={28} /> : <ShieldX size={28} />}
            <div><div className="font-display text-xl font-semibold">{good ? '✓ VALID REC' : `✗ ${r.final_result}`}</div><div className="text-sm opacity-90">{r.headline}</div></div>
            {r.cert_id && <span className="ml-auto font-mono text-sm">{r.cert_id}</span>}
          </div>
        )}
        <Panel title="Verification steps">
          <ol className="space-y-3">
            {(r?.steps ?? [{ step: 1, name: 'Steganographic Integrity', status: 'skipped' as const, detail: 'Extract hidden payload · verify hash' }, { step: 2, name: 'Signature Authentication', status: 'skipped' as const, detail: 'Validate RSA signature' }, { step: 3, name: 'Ledger Lookup', status: 'skipped' as const, detail: 'Check registration · check whether already claimed' }, { step: 4, name: 'Generation Reconciliation', status: 'skipped' as const, detail: 'Compare certified energy with AI / actual generation' }]).map((s) => (
              <li key={s.step} className="flex items-start gap-3">
                <span className={s.status === 'pass' ? 'text-low' : s.status === 'fail' ? 'text-critical' : 'text-ink-3'}>{s.status === 'pass' ? <CheckCircle2 size={20} /> : s.status === 'fail' ? <XCircle size={20} /> : <MinusCircle size={20} />}</span>
                <div><div className="text-sm font-semibold">STEP {s.step} · {s.name}</div><div className="text-xs text-ink-2">{s.detail}</div></div>
              </li>
            ))}
          </ol>
        </Panel>
        {r && (
          <Panel title="Summary">
            <Kv cols={3} items={[{ label: 'Hash', value: <StatusBadge status={r.summary.hash} /> }, { label: 'RSA', value: <StatusBadge status={r.summary.rsa} /> }, { label: 'Ledger', value: <StatusBadge status={r.summary.ledger} /> }, { label: 'Claimed', value: r.summary.claimed }, { label: 'Generation', value: <StatusBadge status={r.summary.generation} /> }, { label: 'Certificate status', value: <StatusBadge status={r.certificate_status} kind="certificate" /> },
              ...(r.reconciliation.expected_kwh != null ? [{ label: 'Certified', value: fmtEnergy(r.reconciliation.certified_kwh) }, { label: 'AI expected', value: fmtEnergy(r.reconciliation.expected_kwh) }, { label: 'Actual', value: fmtEnergy(r.reconciliation.actual_kwh) }] : []),
              ...(r.original_record ? [{ label: 'Signed payload belongs to', value: r.original_record.cert_id, mono: true }] : [])]} />
            {r.extracted_data && <details className="mt-3"><summary className="cursor-pointer text-xs text-ink-3">Extracted payload</summary><pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[11px]">{JSON.stringify(r.extracted_data, null, 2)}</pre></details>}
          </Panel>
        )}
      </div>
    </div>
  );
}
