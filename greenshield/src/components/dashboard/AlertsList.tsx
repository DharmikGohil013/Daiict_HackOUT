import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Alert } from '@/types';
import { RiskLevelBadge } from '@/components/common/RiskBadge';
import { ROUTES } from '@/lib/routes';
import { fmtDateTime } from '@/lib/format';

export function AlertsList({ alerts, linkClaims = true }: { alerts: Alert[]; linkClaims?: boolean }) {
  if (alerts.length === 0) return <p className="text-sm text-ink-3">No active AI alerts.</p>;
  return (
    <ul className="divide-y divide-line">
      {alerts.map((a) => (
        <li key={`${a.claim_id}-${a.fraud_type}`} className="flex items-start gap-3 py-2.5">
          <AlertTriangle size={16} className={a.risk_level === 'CRITICAL' ? 'mt-0.5 text-critical' : 'mt-0.5 text-medium'} />
          <div className="min-w-0 flex-1">
            <div className="text-sm">{linkClaims ? <Link to={ROUTES.government.claim(a.claim_id)} className="text-ink hover:text-primary">{a.text}</Link> : a.text}</div>
            <div className="mt-0.5 text-[11px] text-ink-3">{fmtDateTime(a.at)}</div>
          </div>
          <RiskLevelBadge level={a.risk_level} />
        </li>
      ))}
    </ul>
  );
}
