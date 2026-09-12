import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisTick, chartColor, tooltipStyle } from './palette';

export interface Series { key: string; label: string; color: string; dashed?: boolean; area?: boolean; }

export function LineChart({ data, xKey, series, yFormatter, xFormatter, band }: { data: Array<Record<string, unknown>>; xKey: string; series: Series[]; yFormatter?: (v: number) => string; xFormatter?: (v: string) => string; band?: { lowKey: string; highKey: string; color?: string } }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColor.line} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tick={axisTick} tickFormatter={xFormatter} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={axisTick} tickFormatter={yFormatter} axisLine={false} tickLine={false} width={56} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [yFormatter ? yFormatter(v) : v, series.find((s) => s.key === name)?.label ?? name]} labelFormatter={(l) => (xFormatter ? xFormatter(String(l)) : String(l))} />
        {band && <Area type="monotone" dataKey={band.highKey} stroke="none" fill={band.color ?? chartColor.primary} fillOpacity={0.12} isAnimationActive={false} legendType="none" />}
        {band && <Area type="monotone" dataKey={band.lowKey} stroke="none" fill="rgb(var(--surface))" fillOpacity={1} isAnimationActive={false} legendType="none" />}
        {series.map((s) => (
          s.area
            ? <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={2} dot={false} isAnimationActive={false} />
            : <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} dot={false} isAnimationActive={false} connectNulls />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
