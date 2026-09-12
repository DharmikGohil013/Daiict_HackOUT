import type { RiskLevel } from '@/types';
import { levelForScore } from '@/lib/risk';

const colors: Record<RiskLevel, string> = { LOW: 'rgb(var(--low))', MEDIUM: 'rgb(var(--medium))', HIGH: 'rgb(var(--high))', CRITICAL: 'rgb(var(--critical))' };

/** Semicircular gauge: 0–100 risk score with the four bands drawn underneath. */
export function RiskGauge({ score, level, thresholds = { LOW: 30, MEDIUM: 60, HIGH: 80 }, size = 200 }: { score: number; level?: RiskLevel | null; thresholds?: { LOW: number; MEDIUM: number; HIGH: number }; size?: number }) {
  const lvl = level ?? levelForScore(score, thresholds);
  const r = 80, cx = 100, cy = 95, w = 16;
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from / 100), a1 = Math.PI * (1 - to / 100);
    const x0 = cx + r * Math.cos(a0), y0 = cy - r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy - r * Math.sin(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 ${to - from > 50 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const bands: Array<[number, number, RiskLevel]> = [[0, thresholds.LOW, 'LOW'], [thresholds.LOW, thresholds.MEDIUM, 'MEDIUM'], [thresholds.MEDIUM, thresholds.HIGH, 'HIGH'], [thresholds.HIGH, 100, 'CRITICAL']];
  const needle = Math.PI * (1 - Math.max(0, Math.min(100, score)) / 100);
  const nx = cx + (r - 4) * Math.cos(needle), ny = cy - (r - 4) * Math.sin(needle);
  return (
    <svg viewBox="0 0 200 110" width={size} height={size * 0.55} role="img" aria-label={`Risk score ${score} of 100, ${lvl}`}>
      {bands.map(([a, b, l]) => <path key={l} d={arc(a, b)} stroke={colors[l]} strokeOpacity={l === lvl ? 1 : 0.28} strokeWidth={w} fill="none" strokeLinecap="butt" />)}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="rgb(var(--ink))" strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill="rgb(var(--ink))" />
      <text x={cx} y={cy - 22} textAnchor="middle" fontSize="30" fontWeight="600" fill={colors[lvl]} fontFamily="Fraunces, Georgia, serif">{score}</text>
      <text x={cx} y={cy + 4 - 40 + 40 + 12} textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="1" fill="rgb(var(--ink-3))">{lvl} RISK · / 100</text>
    </svg>
  );
}
