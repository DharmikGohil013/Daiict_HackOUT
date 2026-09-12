import type { ReactNode } from 'react';
import { Panel } from '@/components/common/Panel';

export function ChartCard({ title, subtitle, actions, children, legend }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; legend?: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <Panel title={title} subtitle={subtitle} actions={<>
      {legend && <ul className="flex flex-wrap items-center gap-3 text-xs text-ink-2">{legend.map((l) => <li key={l.label} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: l.dashed ? 'transparent' : l.color, border: l.dashed ? `2px dashed ${l.color}` : undefined }} />{l.label}</li>)}</ul>}
      {actions}
    </>}>
      <div className="h-[260px] w-full">{children}</div>
    </Panel>
  );
}
