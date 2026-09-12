import { Bar, BarChart as RBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { axisTick, chartColor, tooltipStyle } from './palette';

export function BarChart({ data, xKey, series, stacked, yFormatter, xFormatter, layout = 'vertical', colorByRow }: { data: Array<Record<string, unknown>>; xKey: string; series: Array<{ key: string; label: string; color: string }>; stacked?: boolean; yFormatter?: (v: number) => string; xFormatter?: (v: string) => string; layout?: 'vertical' | 'horizontal'; colorByRow?: (row: Record<string, unknown>) => string }) {
  const horizontal = layout === 'horizontal';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RBarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: horizontal ? 8 : 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={chartColor.line} strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? <>
          <XAxis type="number" tick={axisTick} tickFormatter={yFormatter} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey={xKey} tick={axisTick} tickFormatter={xFormatter} axisLine={false} tickLine={false} width={90} />
        </> : <>
          <XAxis dataKey={xKey} tick={axisTick} tickFormatter={xFormatter} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} tickFormatter={yFormatter} axisLine={false} tickLine={false} width={56} />
        </>}
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(var(--surface-2))' }} formatter={(v: number, name: string) => [yFormatter ? yFormatter(v) : v, series.find((s) => s.key === name)?.label ?? name]} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.key} fill={s.color} stackId={stacked ? 'a' : undefined} radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {colorByRow && data.map((row, i) => <Cell key={i} fill={colorByRow(row)} />)}
          </Bar>
        ))}
      </RBarChart>
    </ResponsiveContainer>
  );
}
