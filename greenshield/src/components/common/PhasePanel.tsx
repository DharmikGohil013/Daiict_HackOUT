import type { ReactNode } from 'react';
import { Construction } from 'lucide-react';
import { Panel } from './Panel';

/** Placeholder for features scheduled for a later phase. Always shows the page's real live data where available, never a dead page. */
export function PhasePanel({ phase, title, description, children }: { phase: 4 | 5 | 6; title: string; description?: string; children?: ReactNode }) {
  return (
    <Panel tone="medium" title={<span className="inline-flex items-center gap-2"><Construction size={16} className="text-medium" />{title}</span>} subtitle={`Coming in phase ${phase}${description ? ` — ${description}` : ''}`}>
      {children ?? <p className="text-sm text-ink-3">The data service and navigation for this screen are wired; the full layout ships in phase {phase}.</p>}
    </Panel>
  );
}
