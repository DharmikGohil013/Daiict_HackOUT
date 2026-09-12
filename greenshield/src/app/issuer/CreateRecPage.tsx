import { useState, type FormEvent } from 'react';
import { CheckCircle2, Download, ShieldCheck, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';
import { useIssueRec, usePlants } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { Field } from '@/components/common/FilterBar';
import { Kv } from '@/components/common/Kv';
import { useToast } from '@/components/common/Toast';
import { fileUrl } from '@/services/api/client';
import { shortHash } from '@/lib/format';
import type { ApiError } from '@/types';

export default function CreateRecPage() {
  const plants = usePlants();
  const issue = useIssueRec();
  const toast = useToast();
  const [f, setF] = useState({ certificate_id: '', generator_id: '', energy_kwh: '', generation_date: '', generation_period: '', energy_type: 'Solar', format: 'png' as 'png' | 'pdf' });
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await issue.mutateAsync({ certificate_id: f.certificate_id.trim().toUpperCase() || undefined, generator_id: f.generator_id, energy_kwh: Number(f.energy_kwh), generation_date: f.generation_date, generation_period: f.generation_period || undefined, energy_type: f.energy_type, format: f.format });
      toast.success(`${r.cert_id} issued`, 'Hashed, signed, embedded and registered in the ledger.');
    } catch (err) { toast.error('Issuance failed', (err as ApiError).message + ((err as ApiError).details ? ` — ${(err as ApiError).details!.join(' ')}` : '')); }
  };
  const r = issue.data;
  return (
    <>
      <PageHeader eyebrow="REC issuer module" title="Issue REC" subtitle="REC input data → SHA-256 hash → RSA digital signature → steganographic embedding → ledger registration → REC issued." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Certificate data">
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
            <Field id="r-id" label="Certificate ID" hint="Leave blank to auto-generate"><input id="r-id" className="field font-mono" placeholder="REC-001" value={f.certificate_id} onChange={(e) => setF({ ...f, certificate_id: e.target.value })} /></Field>
            <Field id="r-gen" label="Generator ID"><select id="r-gen" className="field" required value={f.generator_id} onChange={(e) => { const p = plants.data?.plants.find((x) => x.plant_id === e.target.value); setF({ ...f, generator_id: e.target.value, energy_type: p?.energy_type ?? f.energy_type }); }}><option value="">Select plant…</option>{(plants.data?.plants ?? []).map((p) => <option key={p.plant_id} value={p.plant_id}>{p.plant_id} — {p.name}</option>)}</select></Field>
            <Field id="r-kwh" label="Energy (kWh)"><input id="r-kwh" type="number" min="0.001" step="0.001" className="field" required value={f.energy_kwh} onChange={(e) => setF({ ...f, energy_kwh: e.target.value })} /></Field>
            <Field id="r-date" label="Generation date"><input id="r-date" type="date" className="field" required value={f.generation_date} onChange={(e) => setF({ ...f, generation_date: e.target.value })} /></Field>
            <Field id="r-period" label="Generation period" hint="e.g. 2026-08 or 2026-08-01..2026-08-31"><input id="r-period" className="field" value={f.generation_period} onChange={(e) => setF({ ...f, generation_period: e.target.value })} /></Field>
            <Field id="r-type" label="Energy type"><select id="r-type" className="field" value={f.energy_type} onChange={(e) => setF({ ...f, energy_type: e.target.value })}>{['Solar', 'Wind', 'Hydro', 'Biomass', 'Geothermal', 'Tidal', 'Other'].map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field id="r-format" label="File format"><select id="r-format" className="field" value={f.format} onChange={(e) => setF({ ...f, format: e.target.value as 'png' | 'pdf' })}><option value="png">PNG</option><option value="pdf">PDF</option></select></Field>
            <div className="flex items-end">
              <button className="btn btn-primary w-full" type="submit" disabled={issue.isPending}>
                {issue.isPending ? <><Loader2 size={16} className="animate-spin" /><span>Signing &amp; issuing…</span></> : 'Issue REC'}
              </button>
            </div>
          </form>
        </Panel>
        <Panel title={r ? `${r.cert_id} — Successfully Issued` : 'Issuance pipeline'} subtitle={r ? r.issued_at : 'Each step runs server-side with the real keys and ledger.'} actions={r && <a className="btn btn-secondary btn-sm" href={fileUrl(r.download_url)} download><Download size={14} /> Download</a>}>
          <ol className="space-y-2">
            {(r?.steps ?? ['REC Input Data', 'SHA-256 Hash', 'RSA Digital Signature', 'Steganographic Embedding', 'Ledger Registration', 'REC Issued'].map((s) => ({ step: s, status: 'pending' as const, detail: '' }))).map((s, i) => (
              <li key={s.step} className="flex items-start gap-3 text-sm">
                <span className={s.status === 'done' ? 'text-low' : 'text-ink-3'}>{s.status === 'done' ? <CheckCircle2 size={18} /> : <span className="grid h-[18px] w-[18px] place-items-center rounded-full border border-line text-[10px]">{i + 1}</span>}</span>
                <span><span className="font-semibold">{s.step}</span>{s.detail && <span className="block break-all font-mono text-[11px] text-ink-3">{s.detail.length > 80 ? shortHash(s.detail, 32) : s.detail}</span>}</span>
              </li>
            ))}
          </ol>
          {r && <div className="mt-4 border-t border-line pt-4"><Kv cols={2} items={[{ label: 'Hash', value: shortHash(r.hash, 16), mono: true }, { label: 'Signature', value: r.signature }, { label: 'Ledger', value: r.ledger }, { label: 'Claim status', value: r.claim_status }]} />{r.anomaly_flag && <p className="mt-3 rounded-lg bg-medium-soft px-3 py-2 text-xs text-medium">Anomaly flagged for regulator review: {r.anomaly_reason}</p>}
            <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white" data-testid="cert-preview">{r.file_name.toLowerCase().endsWith('.pdf') ? <iframe title={`${r.cert_id} preview`} src={fileUrl(r.preview_url)} className="h-72 w-full" /> : <img src={fileUrl(r.preview_url)} alt={`Certificate ${r.cert_id}`} className="block w-full" />}</div>
            <p className="mt-2 text-xs text-ink-3">The signed payload is hidden in the least-significant bits of these pixels. Editing any visible value breaks the hash.</p>
            <Link className="btn btn-secondary btn-sm mt-3" to={ROUTES.verifier}><ShieldCheck size={14} /> Verify it now</Link></div>}
        </Panel>
      </div>
    </>
  );
}
