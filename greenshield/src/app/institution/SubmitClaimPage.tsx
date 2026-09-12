import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlants, useSubmitClaim } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { CheckCircle2 } from 'lucide-react';
import { Field } from '@/components/common/FilterBar';
import { useToast } from '@/components/common/Toast';
import { ROUTES } from '@/lib/routes';
import type { ApiError } from '@/types';

export default function SubmitClaimPage() {
  const plants = usePlants();
  const submit = useSubmitClaim();
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({ plant_id: '', cert_id: '', transaction_id: '', period_start: '', period_end: '', claimed_mwh: '' });
  const [file, setFile] = useState<File | null>(null);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await submit.mutateAsync({ plant_id: f.plant_id, cert_id: f.cert_id.trim().toUpperCase(), transaction_id: f.transaction_id || undefined, period_start: f.period_start, period_end: f.period_end, claimed_kwh: Number(f.claimed_mwh) * 1000, file });
      const c = r.claim;
      if (c.status === 'verified') toast.success(`Claim ${c.claim_id} verified`, `Risk ${c.risk_score}/100 · certificate ${c.certificate_status}`);
      else if (c.status === 'rejected') toast.error(`Claim ${c.claim_id} rejected`, c.decision_note ?? c.certificate_status ?? '');
      else toast.warn(`Claim ${c.claim_id} flagged for government review`, `Risk ${c.risk_score}/100 · ${c.fraud_type}`);
      navigate(ROUTES.institution.claim(c.claim_id));
    } catch (err) { toast.error('Submission failed', (err as ApiError).message + ((err as ApiError).details ? ` — ${(err as ApiError).details!.join(' ')}` : '')); }
  };
  return (
    <>
      <PageHeader eyebrow="Institution portal" title="Submit claim" subtitle="Your claim will be automatically verified against generation, weather, AI predictions, certificate cryptography, and the REC ledger." />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Panel>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field id="c-plant" label="Generator plant ID"><select id="c-plant" className="field" required value={f.plant_id} onChange={(e) => setF({ ...f, plant_id: e.target.value })}><option value="">Select plant…</option>{(plants.data?.plants ?? []).map((p) => <option key={p.plant_id} value={p.plant_id}>{p.plant_id} — {p.name}</option>)}</select></Field>
          <Field id="c-cert" label="Certificate ID"><input id="c-cert" className="field font-mono" required placeholder="REC-1022" value={f.cert_id} onChange={(e) => setF({ ...f, cert_id: e.target.value })} /></Field>
          <Field id="c-txn" label="Transaction ID" hint="Optional purchase reference"><input id="c-txn" className="field font-mono" placeholder="TXN-2026-0001" value={f.transaction_id} onChange={(e) => setF({ ...f, transaction_id: e.target.value })} /></Field>
          <Field id="c-mwh" label="Claimed renewable energy (MWh)"><input id="c-mwh" type="number" min="0.001" step="0.001" className="field" required value={f.claimed_mwh} onChange={(e) => setF({ ...f, claimed_mwh: e.target.value })} /></Field>
          <Field id="c-start" label="Generation period — start"><input id="c-start" type="date" className="field" required value={f.period_start} onChange={(e) => setF({ ...f, period_start: e.target.value })} /></Field>
          <Field id="c-end" label="Generation period — end"><input id="c-end" type="date" className="field" required value={f.period_end} onChange={(e) => setF({ ...f, period_end: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field id="c-file" label="Certificate upload (PNG or PDF)" hint="The hidden payload, hash, RSA signature and ledger record are verified server-side."><input id="c-file" type="file" accept=".png,.pdf,image/png,application/pdf" className="field" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field></div>
          <div className="sm:col-span-2 flex justify-end"><button type="submit" className="btn btn-primary" disabled={submit.isPending}>{submit.isPending ? 'Verifying…' : 'Submit for Verification'}</button></div>
        </form>
      </Panel>
      <Panel title="What happens next" subtitle="Automatic, in seconds">
        <ol className="space-y-2 text-sm" data-testid="pipeline">{['Claim submitted', 'Certificate validation', 'Steganographic verification', 'Hash verification', 'RSA signature verification', 'Ledger lookup', 'AI generation verification', 'Fraud analysis', 'Government review (if flagged)', 'Final decision'].map((s, i) => <li key={s} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">{i + 1}</span>{s}</li>)}</ol>
        <p className="mt-3 inline-flex items-start gap-2 text-xs text-ink-3"><CheckCircle2 size={14} className="mt-0.5 text-low" />Low-risk claims with an authentic, unclaimed certificate are verified immediately and the certificate is marked as claimed by you.</p>
      </Panel>
      </div>
    </>
  );
}
