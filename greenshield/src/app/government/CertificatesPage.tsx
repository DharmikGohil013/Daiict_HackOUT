import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCertificate, useCertificates } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { Kv } from '@/components/common/Kv';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RiskBadge } from '@/components/common/RiskBadge';
import { ErrorState, LoadingState } from '@/components/common/States';
import { SecurityVerificationCard, checksFromSecurity } from '@/components/security/SecurityVerificationCard';
import { CertificateCard } from '@/components/certificates/CertificateCard';
import { fmtDate, fmtEnergy } from '@/lib/format';
import { ROUTES } from '@/lib/routes';

export default function CertificatesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(id ?? '');
  const list = useCertificates({ limit: 200 });
  const detail = useCertificate(id);
  const submit = (e: FormEvent) => { e.preventDefault(); if (query.trim()) navigate(ROUTES.government.certificate(query.trim().toUpperCase())); };
  return (
    <>
      <PageHeader eyebrow="Government portal" title="Certificate verification" subtitle="Search any certificate ID to see its ledger record, the last cryptographic verification, AI reconciliation and claim state." />
      <form onSubmit={submit} className="mb-4 flex gap-2"><input className="field max-w-sm font-mono" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="REC-1022" aria-label="Certificate ID" /><button className="btn btn-primary" type="submit">Look up</button>{id && <Link className="btn btn-ghost" to={ROUTES.government.certificates}>Clear</Link>}</form>
      {id && (detail.isLoading ? <LoadingState label="Verifying certificate…" /> : detail.isError ? <ErrorState error={detail.error} /> : detail.data && (
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            {detail.data.ledger_record ? <CertificateCard record={detail.data.ledger_record} finalStatus={detail.data.final_status} /> : <Panel title={detail.data.cert_id}><StatusBadge status="NOT FOUND" kind="final" /></Panel>}
            <Panel title="Result">
              <Kv cols={2} items={[
                { label: 'Hash', value: <StatusBadge status={detail.data.checks.hash} /> }, { label: 'RSA', value: <StatusBadge status={detail.data.checks.rsa} /> },
                { label: 'Steganography', value: <StatusBadge status={detail.data.checks.steganography} /> }, { label: 'Ledger', value: <StatusBadge status={detail.data.checks.ledger} /> },
                { label: 'Claim', value: <StatusBadge status={detail.data.checks.claim} /> }, { label: 'Final', value: <StatusBadge status={detail.data.final_status} kind="final" /> },
                { label: 'Institution', value: detail.data.institution_id ?? '—' },
                { label: 'AI expected', value: detail.data.reconciliation?.expected_kwh != null ? `${fmtEnergy(detail.data.reconciliation.expected_lower_kwh)} – ${fmtEnergy(detail.data.reconciliation.expected_upper_kwh)}` : '—' },
                { label: 'Actual', value: fmtEnergy(detail.data.reconciliation?.actual_kwh) }, { label: 'Generation', value: <StatusBadge status={detail.data.reconciliation?.status} /> },
              ]} />
            </Panel>
          </div>
          <SecurityVerificationCard checks={checksFromSecurity(detail.data.security)} result={detail.data.security?.last_result ?? (detail.data.ledger_record ? 'NOT_PROVIDED' : 'NOT_FOUND')} claimedBy={detail.data.ledger_record?.claimed_by} reason={detail.data.reconciliation?.detail} />
          <Panel title="Claims on this certificate" padded={false}>
            <DataTable dense rows={detail.data.claims} rowKey={(c) => c.claim_id} onRowClick={(c) => navigate(ROUTES.government.claim(c.claim_id))} emptyText="No claims yet." columns={[
              { key: 'claim_id', header: 'Claim', render: (c) => <span className="font-mono">{c.claim_id}</span> }, { key: 'inst', header: 'Institution', render: (c) => c.institution_id },
              { key: 'risk', header: 'Risk', render: (c) => <RiskBadge score={c.risk_score} level={c.risk_level} /> }, { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} kind="claim" /> },
            ]} />
          </Panel>
        </div>
      ))}
      <Panel title="REC ledger" subtitle="All issued certificates with their last verification result" padded={false}>
        {list.isError ? <div className="p-4"><ErrorState error={list.error} retry={() => list.refetch()} /></div> : (
          <DataTable rows={list.data?.certificates ?? []} rowKey={(c) => c.cert_id} loading={list.isLoading} onRowClick={(c) => navigate(ROUTES.government.certificate(c.cert_id))} columns={[
            { key: 'cert_id', header: 'Certificate', render: (c) => <span className="font-mono font-semibold">{c.cert_id}</span>, sortValue: (c) => c.cert_id },
            { key: 'gen', header: 'Generator', render: (c) => <span>{c.generator_id}<span className="block text-[11px] text-ink-3">{c.plant_name}</span></span> },
            { key: 'energy', header: 'Energy', align: 'right', render: (c) => fmtEnergy(c.energy_kwh), sortValue: (c) => c.energy_kwh },
            { key: 'date', header: 'Generation date', render: (c) => fmtDate(c.generation_date), sortValue: (c) => c.generation_date },
            { key: 'issuer', header: 'Issuer', render: (c) => c.issuer_id },
            { key: 'hash', header: 'Hash', render: (c) => <StatusBadge status={c.security ? (c.security.hash_verified ? 'MATCH' : c.security.hash_verified === 0 ? 'MISMATCH' : 'NOT CHECKED') : 'NOT CHECKED'} /> },
            { key: 'ledger', header: 'Ledger', render: (c) => <StatusBadge status={c.status.toUpperCase()} kind="final" /> },
            { key: 'final', header: 'Final', render: (c) => <StatusBadge status={c.final_status} kind="final" /> },
          ]} />
        )}
      </Panel>
    </>
  );
}
