import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import { ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import type { NetworkEdge, NetworkNode } from '@/types';
import { cn } from '@/lib/cn';

type N = NetworkNode & SimulationNodeDatum;
type L = SimulationLinkDatum<N> & NetworkEdge;

const riskColor = (r: number) =>
  r > 80 ? 'rgb(var(--critical))' : r > 60 ? 'rgb(var(--high))' : r > 30 ? 'rgb(var(--medium))' : 'rgb(var(--low))';

const riskFill = (r: number) =>
  r > 80 ? 'rgb(var(--critical-soft))' : r > 60 ? 'rgb(var(--high-soft))' : r > 30 ? 'rgb(var(--medium-soft))' : 'rgb(var(--low-soft))';

/* Node size driven by claims — kept compact to prevent crowding */
const NODE_R = (claims: number) => 18 + Math.min(10, claims * 1.5);

/* Collision buffer around every node (shape + label) */
const COLLISION_R = (claims: number) => NODE_R(claims) + 32;

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.2;

/** Institution ↔ plant relationship graph. Layout: d3-force; render: plain SVG with isolated zoom and pan. */
export function NetworkGraph({
  nodes,
  edges,
  selectedId,
  onSelect,
  height: rawHeight = 600,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  selectedId?: string | null;
  onSelect?: (node: NetworkNode) => void;
  height?: number;
}) {
  /* Scale canvas to node count — more nodes need more room */
  const width = Math.max(960, Math.min(1400, nodes.length * 70));
  const height = Math.max(rawHeight, Math.min(900, nodes.length * 40));
  const PAD = 60; // keep nodes away from edges

  const [positions, setPositions] = useState<{ nodes: N[]; links: L[] } | null>(null);
  const key = useMemo(() => nodes.map((n) => n.id).join('|') + edges.length, [nodes, edges]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  /* Zoom and Pan state — isolated exclusively to this graph */
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const hasDraggedRef = useRef(false);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 10) / 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 10) / 10));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // left click only
    if ((e.target as HTMLElement).closest('button')) return;

    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDraggedRef.current = true;
      }

      const svg = svgRef.current;
      const rect = svg ? svg.getBoundingClientRect() : null;
      const scaleFactor = rect && rect.width > 0 ? width / rect.width : 1;

      setPan({
        x: dragStartRef.current.panX + dx * scaleFactor,
        y: dragStartRef.current.panY + dy * scaleFactor,
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, width]);

  /* Wheel zoom: holding Ctrl/Cmd zooms smoothly without hijacking normal page scrolling */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round((z + delta) * 100) / 100)));
      }
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node="true"]')) return;
    if (zoom !== 1 || pan.x !== 0 || pan.y !== 0) {
      handleReset();
    } else {
      setZoom(1.4);
    }
  };

  useEffect(() => {
    const ns: N[] = nodes.map((n) => ({ ...n }));
    const byId = new Map(ns.map((n) => [n.id, n]));
    const ls: L[] = edges
      .filter((e) => byId.has(e.source) && byId.has(e.target))
      .map((e) => ({ ...e, source: e.source, target: e.target }));

    const sim = forceSimulation(ns)
      /* Links: longer distance so nodes don't bunch */
      .force(
        'link',
        forceLink<N, L>(ls)
          .id((d) => d.id)
          .distance(() => 160)
          .strength(0.4),
      )
      /* Charge: strong repulsion to spread everything out */
      .force('charge', forceManyBody().strength(-800).distanceMin(40).distanceMax(600))
      /* Collision: big radius to prevent overlap including labels */
      .force('collide', forceCollide<N>().radius((d) => COLLISION_R(d.claims)).strength(1).iterations(3))
      /* Centering forces */
      .force('center', forceCenter(width / 2, height / 2))
      .force('x', forceX(width / 2).strength(0.04))
      .force('y', forceY(height / 2).strength(0.04))
      .stop();

    /* Run enough ticks for a well-settled layout */
    for (let i = 0; i < 350; i++) sim.tick();

    setPositions({ nodes: ns, links: ls });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, height, width]);

  if (!positions) {
    return (
      <div className="grid place-items-center text-sm text-ink-3" style={{ height: rawHeight }}>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Laying out network…
        </div>
      </div>
    );
  }

  const px = (v: number | undefined) => Math.max(PAD, Math.min(width - PAD, v ?? width / 2));
  const py = (v: number | undefined) => Math.max(PAD, Math.min(height - PAD, v ?? height / 2));

  /* Edge label offset: shift labels perpendicular to the edge so they don't land on the line */
  function edgeLabelOffset(x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // perpendicular unit vector * offset
    const off = 14;
    return { ox: (-dy / len) * off, oy: (dx / len) * off };
  }

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Isolated zoomable graph viewport */}
      <div className="relative overflow-hidden rounded-xl border border-line/70 bg-surface/30">
        {/* Floating Manual Zoom Controls */}
        <div
          className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg border border-line bg-surface/90 p-1 shadow-md backdrop-blur-md select-none"
          role="toolbar"
          aria-label="Network graph zoom controls"
        >
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="flex h-7 w-7 items-center justify-center rounded text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Zoom in (+)"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="flex h-7 w-7 items-center justify-center rounded text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Zoom out (-)"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <div className="mx-0.5 h-4 w-[1px] bg-line" />
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold font-mono text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
            title="Reset zoom (100%) and re-center"
            aria-label="Reset zoom and position"
          >
            <RotateCcw size={12} />
            <span>{Math.round(zoom * 100)}%</span>
          </button>
        </div>

        {/* Pan and interaction hint */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden sm:flex items-center gap-1.5 rounded-full border border-line/50 bg-surface/80 px-2.5 py-1 text-[11px] text-ink-3 shadow-xs backdrop-blur-xs select-none">
          <Move size={11} className="text-ink-3" />
          <span>Drag to pan · Ctrl + scroll to zoom · Double-click to reset</span>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className={cn(
            'h-auto w-full select-none block',
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
          style={{ minWidth: 640, minHeight: rawHeight, touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          role="img"
          aria-label="Relationship network between institutions and plants"
        >
        <defs>
          {/* Glow filter for suspicious edges */}
          <filter id="glow-critical" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Selection ring glow */}
          <filter id="glow-select" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background drag catcher for empty canvas areas */}
        <rect
          x={-width * 2}
          y={-height * 2}
          width={width * 5}
          height={height * 5}
          fill="transparent"
          style={{ pointerEvents: 'all' }}
        />

        {/* Zoom & Pan isolated graph content */}
        <g
          transform={`translate(${width / 2 + pan.x}, ${height / 2 + pan.y}) scale(${zoom}) translate(${-width / 2}, ${-height / 2})`}
        >
          {/* ── Edges ──────────────────────────────────────────── */}
          <g className="edges">
            {positions.links.map((l, i) => {
              const s = l.source as N;
              const t = l.target as N;
              const x1 = px(s.x);
              const y1 = py(s.y);
              const x2 = px(t.x);
              const y2 = py(t.y);
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              const isSus = l.suspicious;
              const { ox, oy } = edgeLabelOffset(x1, y1, x2, y2);

              return (
                <g key={i}>
                  {/* Edge line */}
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={isSus ? 'rgb(var(--critical))' : 'rgb(var(--line-strong))'}
                    strokeWidth={isSus ? 2.5 : 1.5}
                    strokeOpacity={isSus ? 0.85 : 0.35}
                    strokeDasharray={isSus ? undefined : '6 4'}
                    filter={isSus ? 'url(#glow-critical)' : undefined}
                  />

                  {/* Risk score badge on edge — with background pill */}
                  <g transform={`translate(${mx + ox},${my + oy})`}>
                    <rect
                      x={-14} y={-8} width={28} height={16} rx={8}
                      fill={isSus ? 'rgb(var(--critical-soft))' : 'rgb(var(--surface))'}
                      stroke={isSus ? 'rgb(var(--critical))' : 'rgb(var(--line))'}
                      strokeWidth={0.8}
                      opacity={0.9}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="9"
                      fontWeight="700"
                      fill={isSus ? 'rgb(var(--critical))' : 'rgb(var(--ink-3))'}
                      className="num"
                    >
                      {l.max_risk}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* ── Nodes ──────────────────────────────────────────── */}
          <g className="nodes">
            {positions.nodes.map((n) => {
              const r = NODE_R(n.claims);
              const sel = n.id === selectedId;
              const stroke = riskColor(n.max_risk);
              const fill = sel ? riskFill(n.max_risk) : 'rgb(var(--surface))';
              const sw = sel ? 3.5 : 2;
              const cx = px(n.x);
              const cy = py(n.y);
              const label = n.label.length > 18 ? `${n.label.slice(0, 17)}…` : n.label;

              return (
                <g
                  key={n.id}
                  data-node="true"
                  transform={`translate(${cx},${cy})`}
                  className={cn(onSelect && 'cursor-pointer')}
                  onClick={() => {
                    if (hasDraggedRef.current) return;
                    onSelect?.(n);
                  }}
                  role={onSelect ? 'button' : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  aria-label={`${n.kind}: ${n.label}, risk ${n.max_risk}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(n); } }}
                  filter={sel ? 'url(#glow-select)' : undefined}
                >
                  {/* Invisible hit target for easier clicking */}
                  <circle r={r + 10} fill="transparent" />

                  {/* Shape: circle = plant, rounded rect = institution */}
                  {n.kind === 'plant' ? (
                    <circle r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
                  ) : (
                    <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={7} fill={fill} stroke={stroke} strokeWidth={sw} />
                  )}

                  {/* Entity ID inside shape */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="9"
                    fontWeight="700"
                    fill="rgb(var(--ink))"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {n.id}
                  </text>

                  {/* Risk score pill — top right corner */}
                  {n.max_risk > 0 && (
                    <g transform={`translate(${r - 2},${-r - 2})`}>
                      <rect x={-12} y={-7} width={24} height={14} rx={7} fill={stroke} opacity={0.9} />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="8"
                        fontWeight="700"
                        fill="rgb(var(--surface))"
                        className="num"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {n.max_risk}
                      </text>
                    </g>
                  )}

                  {/* Name label below */}
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="500"
                    fill="rgb(var(--ink-2))"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      </div>

      {/* ── Legend ──────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3 text-xs text-ink-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-ink-3 bg-surface" />
            Plant
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded border-2 border-ink-3 bg-surface" />
            Institution
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[3px] w-6 rounded bg-critical" />
            Suspicious
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-6 border-t-2 border-dashed border-line-strong" />
            Normal
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {([
            ['LOW', 'bg-low'],
            ['MED', 'bg-medium'],
            ['HIGH', 'bg-high'],
            ['CRIT', 'bg-critical'],
          ] as const).map(([label, bg]) => (
            <span key={label} className="flex items-center gap-1">
              <span className={cn('h-2.5 w-2.5 rounded-full', bg)} />
              <span className="font-semibold">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
