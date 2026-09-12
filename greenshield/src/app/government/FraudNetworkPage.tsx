import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Info, Activity, Zap, Shield, ExternalLink, Users, Cpu } from 'lucide-react';
import { useEntityProfile, useFraudNetwork } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Panel } from '@/components/common/Panel';
import { NetworkGraph } from '@/components/fraud/NetworkGraph';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { fmtEnergy, fmtNumber } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/cn';
import type { NetworkEdge, NetworkNode } from '@/types';

/* ── Stat pill ─────────────────────────────────────────────────── */
function StatPill({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'default' | 'critical' | 'medium' | 'low' }) {
  const bg = tone === 'critical' ? 'bg-critical-soft text-critical' : tone === 'medium' ? 'bg-medium-soft text-medium' : tone === 'low' ? 'bg-low-soft text-low' : 'bg-surface-2 text-ink-2';
  return (
    <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2', bg)}>
      <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
      <span className="num text-sm font-bold">{value}</span>
    </div>
  );
}

/* ── Suspicious edge row ────────────────────────────────────────── */
function SuspiciousRow({ edge, onSelectNode }: { edge: NetworkEdge; onSelectNode: (id: string) => void }) {
  return (
    <li className="group flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-surface-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => onSelectNode(edge.source)}
              className="rounded font-mono text-ink underline-offset-2 hover:text-primary hover:underline"
            >
              {edge.source}
            </button>
            <span className="text-ink-3">→</span>
            <button
              type="button"
              onClick={() => onSelectNode(edge.target)}
              className="rounded font-mono text-ink underline-offset-2 hover:text-primary hover:underline"
            >
              {edge.target}
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
            <span>{edge.claims} claim{edge.claims !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{fmtEnergy(edge.energy_kwh)} energy</span>
            {edge.fraud_types.length > 0 && (
              <>
                <span>·</span>
                <span className="text-high">{edge.fraud_types.map(t => t.replace(/_/g, ' ')).join(', ')}</span>
              </>
            )}
          </div>
        </div>
        <RiskBadge score={edge.max_risk} />
      </div>
    </li>
  );
}

/* ── Entity inspector panel ─────────────────────────────────────── */
function EntityInspector({ selected, onSelectNode }: { selected: NetworkNode | null; onSelectNode: (id: string) => void }) {
  const profile = useEntityProfile(selected?.kind ?? null, selected?.id ?? null);

  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-ink-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2">
          <Activity size={22} className="text-ink-3" />
        </div>
        <div>
          <div className="text-sm font-semibold text-ink-2">No entity selected</div>
          <div className="mt-1 text-xs">Click any node in the graph to inspect its risk history, energy data, and connected counterparties.</div>
        </div>
      </div>
    );
  }

  if (profile.isLoading) return <LoadingState label="Loading entity profile…" />;
  if (!profile.data) return <ErrorState error={profile.error} />;

  const d = profile.data;
  const flagRatio = d.claims > 0 ? Math.round((d.flagged_claims / d.claims) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-line pb-4">
        <div className={cn(
          'grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg',
          selected.kind === 'plant' ? 'bg-accent-soft text-accent' : 'bg-primary-soft text-primary',
        )}>
          {selected.kind === 'plant' ? <Zap size={18} /> : <Users size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-ink">{selected.label}</div>
          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            <span className="font-mono">{selected.id}</span>
            <span>·</span>
            <span className="capitalize">{selected.kind}</span>
            {selected.energy_type && <><span>·</span><span>{selected.energy_type}</span></>}
          </div>
        </div>
        <RiskBadge score={selected.max_risk} />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <div className="label text-ink-3">Total Claims</div>
          <div className="num mt-0.5 text-lg font-bold text-ink">{d.claims}</div>
        </div>
        <div className={cn('rounded-lg px-3 py-2', flagRatio >= 50 ? 'bg-critical-soft' : flagRatio >= 25 ? 'bg-high-soft' : 'bg-surface-2')}>
          <div className={cn('label', flagRatio >= 50 ? 'text-critical' : flagRatio >= 25 ? 'text-high' : 'text-ink-3')}>Flagged</div>
          <div className={cn('num mt-0.5 text-lg font-bold', flagRatio >= 50 ? 'text-critical' : flagRatio >= 25 ? 'text-high' : 'text-ink')}>
            {d.flagged_claims} <span className="text-sm font-normal opacity-70">({flagRatio}%)</span>
          </div>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <div className="label text-ink-3">Total Energy</div>
          <div className="num mt-0.5 text-sm font-bold text-ink">{fmtEnergy(d.total_energy_kwh)}</div>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <div className="label text-ink-3">Avg Risk</div>
          <div className="num mt-0.5 text-sm font-bold text-ink">{fmtNumber(d.avg_risk, 0)}</div>
        </div>
      </div>

      {/* Counterparties */}
      {d.counterparties.length > 0 && (
        <div>
          <div className="label mb-2 text-ink-3">Counterparties</div>
          <div className="flex flex-wrap gap-1.5">
            {d.counterparties.map((cp) => (
              <button
                key={cp}
                type="button"
                onClick={() => onSelectNode(cp)}
                className="chip bg-surface-2 text-ink-2 transition-colors hover:bg-primary-soft hover:text-primary"
              >
                {cp}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Risk history */}
      {d.risk_history.length > 0 && (
        <div>
          <div className="label mb-2 text-ink-3">Risk History</div>
          <ul className="space-y-1">
            {d.risk_history.map((h) => (
              <li key={h.claim_id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                <Link
                  to={ROUTES.government.claim(h.claim_id)}
                  className="flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                >
                  {h.claim_id}
                  <ExternalLink size={10} />
                </Link>
                <div className="flex items-center gap-1.5">
                  <RiskBadge score={h.risk_score} level={h.risk_level} />
                  <StatusBadge status={h.status} kind="claim" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Profile link */}
      <Link
        className="btn btn-secondary btn-sm w-full"
        to={selected.kind === 'plant' ? ROUTES.government.plant(selected.id) : ROUTES.government.institution(selected.id)}
      >
        <Cpu size={14} />
        Open full profile
      </Link>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────── */
export default function FraudNetworkPage() {
  const q = useFraudNetwork();
  const [selected, setSelected] = useState<NetworkNode | null>(null);

  if (q.isLoading) return <LoadingState label="Building relationship network…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;

  const { nodes, edges, disclaimer } = q.data;
  const suspicious = edges.filter((e) => e.suspicious);
  const totalClaims = nodes.reduce((s, n) => s + n.claims, 0);
  const criticalNodes = nodes.filter((n) => n.max_risk > 80);

  // Allow inspector to jump-select a node by ID
  const handleSelectById = (id: string) => {
    const found = nodes.find((n) => n.id === id);
    if (found) setSelected(found);
  };

  return (
    <>
      <PageHeader
        eyebrow="Government portal"
        title="Fraud network"
        subtitle="Statistical relationship map of institutions and generation plants. Use this to identify coordinated patterns for further investigation."
      />

      {/* Summary KPIs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatPill label="Entities" value={nodes.length} />
        <StatPill label="Relationships" value={edges.length} />
        <StatPill label="Total Claims" value={totalClaims} />
        <StatPill label="Suspicious Links" value={suspicious.length} tone={suspicious.length > 0 ? 'critical' : 'low'} />
        <StatPill label="High-Risk Nodes" value={criticalNodes.length} tone={criticalNodes.length > 0 ? 'medium' : 'low'} />
      </div>

      {/* Disclaimer */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-medium/30 bg-medium-soft/30 px-4 py-3 text-sm text-ink-2">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-medium" />
        <p className="leading-relaxed">
          <span className="font-semibold text-ink">Statistical signals only — </span>
          {disclaimer || 'Relationships are statistical signals for review, not findings of collusion. All flagged connections require officer investigation before any enforcement action.'}
        </p>
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Graph */}
        <Panel
          title="Institutions ↔ Plants"
          subtitle={`${nodes.length} entities · ${edges.length} relationships · ${suspicious.length} potentially suspicious`}
        >
          <NetworkGraph
            nodes={nodes}
            edges={edges}
            selectedId={selected?.id}
            onSelect={setSelected}
          />
        </Panel>

        {/* Right column */}
        <div className="space-y-4">
          {/* Entity inspector */}
          <Panel
            title={selected ? selected.label : 'Entity Inspector'}
            subtitle={selected ? `${selected.kind} · ${selected.id}` : undefined}
            actions={selected && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-xs"
                onClick={() => setSelected(null)}
              >
                Clear
              </button>
            )}
          >
            <EntityInspector selected={selected} onSelectNode={handleSelectById} />
          </Panel>

          {/* Suspicious relationships list */}
          <Panel
            title="Potentially suspicious relationships"
            subtitle={suspicious.length > 0 ? `${suspicious.length} connection${suspicious.length !== 1 ? 's' : ''} flagged for review` : undefined}
            padded={false}
            tone={suspicious.length > 0 ? 'critical' : 'default'}
          >
            {suspicious.length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-5 text-sm text-ink-3">
                <Shield size={16} className="text-low" />
                No suspicious relationships detected in the current dataset.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-[11px] text-ink-3">
                  <AlertTriangle size={12} className="text-critical" />
                  <span>Click a node ID to select it in the graph</span>
                </div>
                <ul className="divide-y divide-line">
                  {suspicious.map((e) => (
                    <SuspiciousRow key={`${e.source}-${e.target}`} edge={e} onSelectNode={handleSelectById} />
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
