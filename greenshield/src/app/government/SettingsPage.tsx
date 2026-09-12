import { useModelInfo } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { Kv } from '@/components/common/Kv';
import { PhasePanel } from '@/components/common/PhasePanel';
import { API_BASE, MOCK_API } from '@/services/api/client';
import { useAuth } from '@/lib/auth';

export default function SettingsPage() {
  const model = useModelInfo();
  const user = useAuth((s) => s.user);
  return (
    <>
      <PageHeader eyebrow="Government portal" title="Settings" subtitle="Environment, model and risk engine configuration." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Session"><Kv cols={1} items={[{ label: 'Signed in as', value: user?.email }, { label: 'Role', value: user?.role }, { label: 'Organisation', value: user?.organisation ?? '—' }, { label: 'API base', value: API_BASE || '(same origin)' , mono: true }, { label: 'Data source', value: MOCK_API ? 'Sample data (mock mode)' : 'Live backend' }]} /></Panel>
        <Panel title="Generation model"><Kv cols={1} items={[{ label: 'Version', value: model.data?.model.version ?? '…' }, { label: 'Algorithm', value: model.data?.model.algorithm ?? '…' }, { label: 'Hold-out R²', value: String(model.data?.model.metrics?.r2 ?? '…') }, { label: 'MAPE', value: model.data?.model.metrics?.mape_pct != null ? `${model.data.model.metrics.mape_pct}%` : '…' }]} /></Panel>
      </div>
      <div className="mt-4"><PhasePanel phase={6} title="Risk thresholds and weights editor" description="RISK_THRESHOLDS / RISK_WEIGHTS are configurable in the backend today" /></div>
    </>
  );
}
