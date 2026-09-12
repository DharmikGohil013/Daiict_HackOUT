import { useInstitutionDashboard } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/States';
import { fmtDate, fmtEnergy } from '@/lib/format';

export default function InstitutionCertificatesPage() {
  const id = useAuth((s) => s.user?.entity_id);
  const q = useInstitutionDashboard(id);
  return (
    <>
      <PageHeader eyebrow="Institution portal" title="Certificates" subtitle="Every REC you have claimed, with its cryptographic and ledger status." />
      {q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <DataTable rows={q.data?.certificates ?? []} rowKey={(c) => c.claim_id} loading={q.isLoading} columns={[
          { key: 'cert', header: 'Certificate ID', render: (c) => <span className="font-mono font-semibold">{c.cert_id}</span> },
          { key: 'gen', header: 'Generator', render: (c) => <span>{c.generator}<span className="block text-[11px] text-ink-3">{c.plant_name}</span></span> },
          { key: 'energy', header: 'Energy', align: 'right', render: (c) => fmtEnergy(c.energy_kwh) },
          { key: 'date', header: 'Date', render: (c) => fmtDate(c.date) },
          { key: 'hash', header: 'Hash', render: (c) => <StatusBadge status={c.hash_status} /> },
          { key: 'sig', header: 'Signature', render: (c) => <StatusBadge status={c.signature_status} /> },
          { key: 'claim', header: 'Claim status', render: (c) => <StatusBadge status={c.claim_status} kind="claim" /> },
          { key: 'final', header: 'Final', render: (c) => <StatusBadge status={c.final_status} kind="final" /> },
        ]} />
      )}
    </>
  );
}
