import { cn } from '@/lib/cn';
import { certStatusTone, claimStatusTone } from '@/lib/risk';
import { titleCase } from '@/lib/format';

type Tone = 'low' | 'medium' | 'high' | 'critical' | 'info' | 'neutral';
const cls: Record<Tone, string> = { low: 'bg-low-soft text-low', medium: 'bg-medium-soft text-medium', high: 'bg-high-soft text-high', critical: 'bg-critical-soft text-critical', info: 'bg-info-soft text-info', neutral: 'bg-surface-2 text-ink-2' };

const investigationTone: Record<string, Tone> = { open: 'high', awaiting_evidence: 'medium', resolved_approved: 'low', resolved_rejected: 'critical' };
const plantTone: Record<string, Tone> = { active: 'low', under_review: 'medium', suspended: 'critical' };
const finalTone: Record<string, Tone> = { VALID: 'low', CLAIMED: 'low', CONSISTENT: 'low', TAMPERED: 'critical', DUPLICATE: 'critical', 'NOT FOUND': 'high', REVOKED: 'high', INCONSISTENT: 'high', PENDING: 'medium', NORMAL: 'low', WATCH: 'medium', ANOMALY: 'critical', 'NO DATA': 'neutral', MATCH: 'low', MISMATCH: 'critical', INVALID: 'critical', REGISTERED: 'low', SKIPPED: 'neutral', UNKNOWN: 'neutral', 'NOT CHECKED': 'neutral', 'NOT CLAIMED': 'low' };

export function StatusBadge({ status, kind = 'generic', className }: { status: string | null | undefined; kind?: 'claim' | 'certificate' | 'investigation' | 'plant' | 'final' | 'generic'; className?: string }) {
  if (!status) return <span className={cn('chip', cls.neutral, className)}>—</span>;
  let tone: Tone = 'neutral';
  if (kind === 'claim') tone = claimStatusTone(status);
  else if (kind === 'certificate') tone = certStatusTone(status);
  else if (kind === 'investigation') tone = investigationTone[status] ?? 'neutral';
  else if (kind === 'plant') tone = plantTone[status] ?? 'neutral';
  else tone = finalTone[status] ?? (status.includes('VALID') || status === 'pass' ? 'low' : status.includes('FAIL') || status === 'fail' ? 'critical' : 'neutral');
  const label = kind === 'claim' || kind === 'investigation' || kind === 'plant' ? titleCase(status) : status.replace(/_/g, ' ');
  return <span className={cn('chip', cls[tone], className)}>{label}</span>;
}
