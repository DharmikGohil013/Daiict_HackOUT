import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { tooltipStyle } from './palette';
import { fmtNumber } from '@/lib/format';

export function DonutChart({ data, centerLabel, centerValue }: { data: Array<{ name: string; value: number; color: string }>; centerLabel?: string; centerValue?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex h-full items-center gap-4">
      <div className="relative h-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtNumber(v), '']} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><div className="num font-display text-2xl font-semibold leading-none">{centerValue ?? fmtNumber(total)}</div>{centerLabel && <div className="label mt-1">{centerLabel}</div>}</div>
        </div>
      </div>
      <ul className="w-36 space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-ink-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />{d.name}</span>
            <span className="num font-semibold">{fmtNumber(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
