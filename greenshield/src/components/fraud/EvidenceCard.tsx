import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Panel } from '@/components/common/Panel';
import { Kv } from '@/components/common/Kv';

export function EvidenceCard({ title, icon: Icon, items, children, tone, actions }: { title: string; icon?: LucideIcon; items?: Array<{ label: ReactNode; value: ReactNode; mono?: boolean }>; children?: ReactNode; tone?: 'default' | 'critical' | 'low' | 'medium'; actions?: ReactNode }) {
  return (
    <Panel tone={tone} title={<span className="inline-flex items-center gap-2">{Icon && <Icon size={16} className="text-primary" />}{title}</span>} actions={actions}>
      {items && <Kv items={items} cols={2} />}
      {children}
    </Panel>
  );
}
