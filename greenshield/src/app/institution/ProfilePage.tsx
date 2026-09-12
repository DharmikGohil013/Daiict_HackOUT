import { useInstitutionDashboard } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { Kv } from '@/components/common/Kv';
import { ErrorState, LoadingState } from '@/components/common/States';
import { fmtDate } from '@/lib/format';

export default function InstitutionProfilePage() {
  const user = useAuth((s) => s.user);
  const q = useInstitutionDashboard(user?.entity_id);
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const i = q.data.institution;
  return (
    <>
      <PageHeader eyebrow="Institution portal" title="Profile" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Institution"><Kv cols={1} items={[{ label: 'ID', value: i.institution_id, mono: true }, { label: 'Name', value: i.name }, { label: 'Sector', value: i.sector ?? '—' }, { label: 'Location', value: i.location ?? '—' }, { label: 'Contact', value: i.contact_email ?? '—' }, { label: 'Registered', value: fmtDate(i.registered_at) }]} /></Panel>
        <Panel title="Account"><Kv cols={1} items={[{ label: 'Email', value: user?.email }, { label: 'Role', value: user?.role }, { label: 'Display name', value: user?.display_name ?? '—' }]} /></Panel>
      </div>
    </>
  );
}
