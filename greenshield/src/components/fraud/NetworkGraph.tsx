import { useEffect, useMemo, useState } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import type { NetworkEdge, NetworkNode } from '@/types';
import { cn } from '@/lib/cn';

type N = NetworkNode & SimulationNodeDatum;
type L = SimulationLinkDatum<N> & NetworkEdge;

const riskColor = (r: number) =>
  r > 80 ? 'rgb(var(--critical))' : r > 60 ? 'rgb(var(--high))' : r > 30 ? 'rgb(var(--medium))' : 'rgb(var(--low))';

const riskFill = (r: number) =>
  r > 80 ? 'rgb(var(--critical-soft))' : r > 60 ? 'rgb(var(--high-soft))' : r > 30 ? 'rgb(var(--medium-soft))' : 'rgb(var(--low-soft))';

const nodeRadius = (claims: number) => 16 + Math.min(14, claims * 1.8);

/** Institution ↔ plant relationship graph. Layout: d3-force; render: plain SVG. */
export function NetworkGraph({
  nodes,
  edges,
  selectedId,
  onSelect,
  height = 520,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  selectedId?: string | null;
  onSelect?: (node: NetworkNode) => void;
  height?: number;
}) {
  const width = 900;
  const [positions, setPositions] = useState<{ nodes: N[]; links: L[] } | null>(null);
  const key = useMemo(() => nodes.map((n) => n.id).join('|') + edges.length, [nodes, edges]);

  useEffect(() => {
    const ns: N[] = nodes.map((n) => ({ ...n }));
    const byId = new Map(ns.map((n) => [n.id, n]));
    const ls: L[] = edges
      .filter((e) => byId.has(e.source) && byId.has(e.target))
      .map((e) => ({ ...e, source: e.source, target: e.target }));

    const sim = forceSimulation(ns)
      .force('link', forceLink<N, L>(ls).id((d) => d.id).distance((l) => 100 + Math.min(70, l.claims * 12)))
      .force('charge', forceManyBody().strength(-400))
      .force('collide', forceCollide<N>().radius((d) => nodeRadius(d.claims) + 8))
      .force('center', forceCenter(width / 2, height / 2))
      .stop();

    for (let i = 0; i < 240; i++) sim.tick();
    setPositions({ nodes: ns, links: ls });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, height]);

  if (!positions) {
    return (
      <div className="grid place-items-center text-sm text-ink-3" style={{ height }}>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Laying out network…
        </div>
      </div>
    );
  }

  const px = (v: number | undefined) => Math.max(32, Math.min(width - 32, v ?? width / 2));
  const py = (v: number | undefined) => Math.max(32, Math.min(height - 32, v ?? height / 2));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[640px]"
        role="img"
        aria-label="Relationship network between institutions and plants"
      >
        <defs>
          {/* Arrow marker for normal edges */}
          <marker id="arrow-normal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgb(var(--line-strong))" opacity="0.5" />
          </marker>
          {/* Arrow marker for suspicious edges */}
          <marker id="arrow-suspicious" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgb(var(--critical))" opacity="0.8" />
          </marker>
          {/* Glow filter for suspicious edges */}
          <filter id="glow-critical" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Selection glow */}
          <filter id="glow-select" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {positions.links.map((l, i) => {
          const s = l.source as N;
          const t = l.target as N;
          const x1 = px(s.x);
          const y1 = py(s.y);
          const x2 = px(t.x);
          const y2 = py(t.y);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;

          return (
            <g key={i}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={l.suspicious ? 'rgb(var(--critical))' : 'rgb(var(--line-strong))'}
                strokeWidth={l.suspicious ? 2 + Math.min(4, l.claims * 0.5) : 1 + Math.min(3, l.claims * 0.3)}
                strokeOpacity={l.suspicious ? 0.9 : 0.45}
                strokeDasharray={l.suspicious ? undefined : '5 5'}
                filter={l.suspicious ? 'url(#glow-critical)' : undefined}
                markerEnd={l.suspicious ? 'url(#arrow-suspicious)' : 'url(#arrow-normal)'}
              />
              {/* Risk label on edge midpoint */}
              <text
                x={mx} y={my - 6}
                fontSize="10"
                fontWeight="600"
                textAnchor="middle"
                fill={l.suspicious ? 'rgb(var(--critical))' : 'rgb(var(--ink-3))'}
                className="num"
              >
                {l.max_risk}
              </text>
              {l.suspicious && (
                <text
                  x={mx} y={my + 8}
                  fontSize="9"
                  textAnchor="middle"
                  fill="rgb(var(--critical))"
                  opacity="0.75"
                >
                  {l.claims}c · {l.flagged}f
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {positions.nodes.map((n) => {
          const r = nodeRadius(n.claims);
          const sel = n.id === selectedId;
          const stroke = riskColor(n.max_risk);
          const fill = sel ? riskFill(n.max_risk) : 'rgb(var(--surface))';
          const sw = sel ? 4 : 2;
          const label = n.label.length > 20 ? `${n.label.slice(0, 19)}…` : n.label;

          return (
            <g
              key={n.id}
              transform={`translate(${px(n.x)},${py(n.y)})`}
              className={cn(onSelect && 'cursor-pointer')}
              onClick={() => onSelect?.(n)}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={`${n.kind}: ${n.label}, risk ${n.max_risk}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect?.(n); }}
              filter={sel ? 'url(#glow-select)' : undefined}
            >
              {/* Shape: circle = plant, rounded-square = institution */}
              {n.kind === 'plant' ? (
                <circle r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
              ) : (
                <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={8} fill={fill} stroke={stroke} strokeWidth={sw} />
              )}

              {/* Entity ID label inside shape */}
              <text
                y={5}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="rgb(var(--ink))"
                style={{ userSelect: 'none' }}
              >
                {n.id}
              </text>

              {/* Display label below node */}
              <text
                y={r + 14}
                textAnchor="middle"
                fontSize="10"
                fill="rgb(var(--ink-2))"
                style={{ userSelect: 'none' }}
              >
                {label}
              </text>

              {/* Risk score badge in corner */}
              {n.max_risk > 0 && (
                <text
                  y={-r + 9}
                  x={r - 4}
                  textAnchor="end"
                  fontSize="8"
                  fontWeight="700"
                  fill={stroke}
                  className="num"
                  style={{ userSelect: 'none' }}
                >
                  {n.max_risk}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-ink-3" />
          Generation plant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded border-2 border-ink-3" />
          Institution
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 bg-critical" />
          Suspicious link
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-line-strong" />
          Normal relationship
        </span>
        <span className="ml-auto flex items-center gap-3">
          {([['LOW', 'low'], ['MEDIUM', 'medium'], ['HIGH', 'high'], ['CRITICAL', 'critical']] as const).map(([label, t]) => (
            <span key={t} className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', `bg-${t}`)} />
              {label}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
