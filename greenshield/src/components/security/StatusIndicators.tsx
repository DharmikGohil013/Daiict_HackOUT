import { CheckCircle2, XCircle, AlertTriangle, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type Tri = boolean | null | undefined;

export function Indicator({ label, ok, okText, failText, warn, skippedText = 'Not checked', className }: { label: string; ok: Tri; okText: string; failText: string; warn?: boolean; skippedText?: string; className?: string }) {
  const state = ok === null || ok === undefined ? 'skipped' : warn ? 'warn' : ok ? 'ok' : 'fail';
  const Icon = state === 'ok' ? CheckCircle2 : state === 'fail' ? XCircle : state === 'warn' ? AlertTriangle : MinusCircle;
  const color = state === 'ok' ? 'text-low' : state === 'fail' ? 'text-critical' : state === 'warn' ? 'text-medium' : 'text-ink-3';
  return (
    <div className={cn('flex items-center justify-between gap-3 py-2', className)}>
      <span className="text-sm text-ink-2">{label}</span>
      <span className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', color)}><Icon size={16} />{state === 'skipped' ? skippedText : state === 'ok' ? okText : failText}</span>
    </div>
  );
}

export const StegStatus = ({ ok }: { ok: Tri }) => <Indicator label="Steganographic Payload" ok={ok} okText="Extracted" failText="Not found" />;
export const HashStatus = ({ ok }: { ok: Tri }) => <Indicator label="SHA-256 Hash" ok={ok} okText="MATCH" failText="MISMATCH" />;
export const RsaStatus = ({ ok }: { ok: Tri }) => <Indicator label="RSA Signature" ok={ok} okText="VALID" failText="INVALID" />;
export const LedgerStatus = ({ ok, text }: { ok: Tri; text?: { ok?: string; fail?: string } }) => <Indicator label="Ledger Record" ok={ok} okText={text?.ok ?? 'REGISTERED · HASH MATCHES'} failText={text?.fail ?? 'DOES NOT MATCH'} />;
export const ClaimStatus = ({ ok, claimedBy }: { ok: Tri; claimedBy?: string | null }) => <Indicator label="Claim Status" ok={ok} okText="NOT PREVIOUSLY CLAIMED" failText={claimedBy ? `ALREADY CLAIMED · ${claimedBy}` : 'ALREADY CLAIMED'} />;
