import { useEffect, useMemo, useState } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import type { NetworkEdge, NetworkNode } from '@/types';
import { cn } from '@/lib/cn';

type N = NetworkNode & SimulationNodeDatum;
type L = SimulationLinkDatum<N> & NetworkEdge;

const riskColor = (r: number) => (r > 80 ? 'rgb(var(--critical))' : r > 60 ? 'rgb(var(--high))' : r > 30 ? 'rgb(var(--medium))' : 'rgb(var(--low))');

/** Institution ↔ plant relationship graph. Layout: d3-force; render: plain SVG. Wording follows FinalMD §22. */
export function NetworkGraph({ nodes, edges, selectedId, onSelect, height = 520 }: { nodes: NetworkNode[]; edges: NetworkEdge[]; selectedId?: string | null; onSelect?: (node: NetworkNode) => void; height?: number }) {
  const width = 900;
  const [positions, setPositions] = useState<{ nodes: N[]; links: L[] } | null>(null);
  const key = useMemo(() => nodes.map((n) => n.id).join('|') + edges.length, [nodes, edges]);

  useEffect(() => {
    const ns: N[] = nodes.map((n) => ({ ...n }));
    const byId = new Map(ns.map((n) => [n.id, n]));
    const ls: L[] = edges.filter((e) => byId.has(e.source) && byId.has(e.target)).map((e) => ({ ...e, source: e.source, target: e.target }));
    const sim = forceSimulation(ns)
      .force('link', forceLink<N, L>(ls).id((d) => d.id).distance((l) => 90 + Math.min(60, l.claims * 10)))
      .force('charge', forceManyBody().strength(-360))
      .force('collide', forceCollide<N>().radius((d) => 18 + Math.min(14, d.claims * 2)))
      .force('center', forceCenter(width / 2, height / 2))
      .stop();
    for (let i = 0; i < 220; i++) sim.tick();
    setPositions({ nodes: ns, links: ls });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, height]);

  if (!positions) return <div className="grid place-items-center text-sm text-ink-3" style={{ height }}>Laying out network…</div>;
  const px = (v: number | undefined) => Math.max(24, Math.min(width - 24, v ?? width / 2));
  const py = (v: number | undefined) => Math.max(24, Math.min(height - 24, v ?? height / 2));
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[640px]" role="img" aria-label="Relationship network between institutions and plants">
        {positions.links.map((l, i) => {
          const s = l.source as N, t = l.target as N;
          return (
            <g key={i}>
              <line x1={px(s.x)} y1={py(s.y)} x2={px(t.x)} y2={py(t.y)} stroke={l.suspicious ? 'rgb(var(--critical))' : 'rgb(var(--line-strong))'} strokeWidth={1 + Math.min(5, l.claims)} strokeOpacity={l.suspicious ? 0.8 : 0.6} strokeDasharray={l.suspicious ? undefined : '4 4'} />
              <text x={(px(s.x) + px(t.x)) / 2} y={(py(s.y) + py(t.y)) / 2 - 4} fontSize="10" textAnchor="middle" fill={l.suspicious ? 'rgb(var(--critical))' : 'rgb(var(--ink-3))'} className="num">{l.max_risk}%</text>
            </g>
          );
        })}
        {positions.nodes.map((n) => {
          const r = 14 + Math.min(12, n.claims * 2);
          const sel = n.id === selectedId;
          return (
            <g key={n.id} transform={`translate(${px(n.x)},${py(n.y)})`} className={cn(onSelect && 'cursor-pointer')} onClick={() => onSelect?.(n)} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.(n); }}>
              {n.kind === 'plant'
                ? <circle r={r} fill="rgb(var(--surface))" stroke={riskColor(n.max_risk)} strokeWidth={sel ? 4 : 2.5} />
                : <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={6} fill="rgb(var(--surface))" stroke={riskColor(n.max_risk)} strokeWidth={sel ? 4 : 2.5} />}
              <text y={4} textAnchor="middle" fontSize="9" fontWeight="700" fill="rgb(var(--ink))">{n.id}</text>
              <text y={r + 12} textAnchor="middle" fontSize="10" fill="rgb(var(--ink-2))">{n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-3">
        <span><span className="mr-1 inline-block h-3 w-3 rounded-full border-2 border-ink-3 align-middle" /> plant</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded-sm border-2 border-ink-3 align-middle" /> institution</span>
        <span><span className="mr-1 inline-block h-0.5 w-5 bg-critical align-middle" /> Potentially Suspicious Relationship</span>
        <span><span className="mr-1 inline-block h-0.5 w-5 border-t-2 border-dashed border-line-strong align-middle" /> normal</span>
      </div>
    </div>
  );
}
