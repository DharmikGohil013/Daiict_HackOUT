import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEntityProfile, useFraudNetwork } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Panel } from '@/components/common/Panel';
import { Kv } from '@/components/common/Kv';
import { NetworkGraph } from '@/components/fraud/NetworkGraph';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { fmtEnergy, fmtNumber } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import type { NetworkNode } from '@/types';

export default function FraudNetworkPage() {
  const q = useFraudNetwork();
  const [selected, setSelected] = useState<NetworkNode | null>(null);
  const profile = useEntityProfile(selected?.kind ?? null, selected?.id ?? null);
  if (q.isLoading) return <LoadingState label="Building relationship network…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const suspicious = q.data.edges.filter((e) => e.suspicious);
  return (
    <>
      <PageHeader eyebrow="Government portal" title="Fraud network" subtitle={q.data.disclaimer} />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel title="Institutions ↔ generators" subtitle={`${q.data.nodes.length} entities · ${q.data.edges.length} relationships · ${suspicious.length} potentially suspicious`}>
          <NetworkGraph nodes={q.data.nodes} edges={q.data.edges} selectedId={selected?.id} onSelect={setSelected} />
        </Panel>
        <div className="space-y-4">
          <Panel title={selected ? selected.label : 'Select an entity'} subtitle={selected ? `${selected.kind} · ${selected.id}` : 'Click a node to see its claims, energy, flags and risk history.'}>
            {selected && (profile.isLoading ? <LoadingState /> : profile.data ? (
              <>
                <Kv cols={2} items={[{ label: 'Claims', value: profile.data.claims }, { label: 'Flagged', value: profile.data.flagged_claims }, { label: 'Total energy', value: fmtEnergy(profile.data.total_energy_kwh) }, { label: 'Average risk', value: fmtNumber(profile.data.avg_risk, 0) }, { label: 'Counterparties', value: profile.data.counterparties.join(', ') || '—' }, { label: 'Certificates', value: profile.data.certificates.join(', ') || '—' }]} />
                <div className="mt-4"><div className="label mb-1">Risk history</div><ul className="space-y-1 text-xs">{profile.data.risk_history.map((h) => <li key={h.claim_id} className="flex items-center justify-between gap-2"><Link to={ROUTES.government.claim(h.claim_id)} className="font-mono">{h.claim_id}</Link><RiskBadge score={h.risk_score} level={h.risk_level} /><StatusBadge status={h.status} kind="claim" /></li>)}</ul></div>
                <Link className="btn btn-secondary btn-sm mt-4" to={selected.kind === 'plant' ? ROUTES.government.plant(selected.id) : ROUTES.government.institution(selected.id)}>Open profile</Link>
              </>
            ) : <ErrorState error={profile.error} />)}
          </Panel>
          <Panel title="Potentially suspicious relationships" padded={false}>
            <ul className="divide-y divide-line text-sm">
              {suspicious.map((e) => <li key={`${e.source}-${e.target}`} className="flex items-center justify-between gap-2 px-4 py-2"><span><span className="font-mono">{e.source}</span> → <span className="font-mono">{e.target}</span><span className="block text-[11px] text-ink-3">{e.claims} claim(s) · {e.fraud_types.join(', ') || 'high deviation'}</span></span><RiskBadge score={e.max_risk} /></li>)}
              {suspicious.length === 0 && <li className="px-4 py-3 text-ink-3">None.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
