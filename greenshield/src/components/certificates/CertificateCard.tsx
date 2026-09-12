import { FileBadge2, Download } from 'lucide-react';
import type { LedgerRecord } from '@/types';
import { Panel } from '@/components/common/Panel';
import { Kv } from '@/components/common/Kv';
import { StatusBadge } from '@/components/common/StatusBadge';
import { fileUrl } from '@/services/api/client';
import { fmtDate, fmtDateTime, fmtEnergy, shortHash } from '@/lib/format';

export function CertificateCard({ record, finalStatus, title = 'Certificate' }: { record: Partial<LedgerRecord> & { cert_id: string }; finalStatus?: string | null; title?: string }) {
  const file = record.cert_file_path ? record.cert_file_path.split(/[\\/]/).pop() : null;
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><FileBadge2 size={16} className="text-primary" />{title}</span>} actions={<>
      {finalStatus && <StatusBadge status={finalStatus} kind="final" />}
      {file && <a className="btn btn-secondary btn-sm" href={fileUrl(`/api/certificate/${file}`)} download><Download size={14} /> File</a>}
    </>}>
      <div className="mb-3 font-mono text-lg font-bold">{record.cert_id}</div>
      <Kv cols={2} items={[
        { label: 'Generator', value: record.generator_id },
        { label: 'Energy', value: fmtEnergy(record.energy_kwh) },
        { label: 'Generation date', value: fmtDate(record.generation_date) },
        { label: 'Issuer', value: record.issuer_id },
        { label: 'Ledger status', value: <StatusBadge status={record.status?.toUpperCase()} kind="final" /> },
        { label: 'Issued', value: fmtDateTime(record.issued_at) },
        { label: 'SHA-256', value: shortHash(record.data_hash, 16), mono: true },
        { label: 'Claimed by', value: record.claimed_by ? `${record.claimed_by} · ${fmtDate(record.claimed_at)}` : 'Not claimed' },
      ]} />
    </Panel>
  );
}
