import { useInstitutionDashboard } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { ErrorState } from '@/components/common/States';
import { fmtDateTime, fmtEnergy, fmtNumber } from '@/lib/format';

export default function TransactionsPage() {
  const id = useAuth((s) => s.user?.entity_id);
  const q = useInstitutionDashboard(id);
  return (
    <>
      <PageHeader eyebrow="Institution portal" title="Transactions" subtitle="REC purchases linked to your claims." />
      {q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <DataTable rows={q.data?.transactions ?? []} rowKey={(t) => t.transaction_id} loading={q.isLoading} columns={[
          { key: 'id', header: 'Transaction', render: (t) => <span className="font-mono font-semibold">{t.transaction_id}</span> },
          { key: 'cert', header: 'Certificate', render: (t) => <span className="font-mono">{t.cert_id ?? '—'}</span> },
          { key: 'seller', header: 'Seller plant', render: (t) => t.seller_plant_id ?? '—' },
          { key: 'energy', header: 'Energy', align: 'right', render: (t) => fmtEnergy(t.energy_kwh) },
          { key: 'price', header: 'Price', align: 'right', render: (t) => (t.price_inr != null ? `₹ ${fmtNumber(t.price_inr)}` : '—') },
          { key: 'at', header: 'Date', render: (t) => fmtDateTime(t.created_at) },
        ]} />
      )}
    </>
  );
}
