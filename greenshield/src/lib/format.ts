/** Number/energy/date formatting used across the platform. Energy is stored in kWh and shown in MWh/GWh. */
export function fmtNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function kwhToMwh(kwh: number | null | undefined): number | null {
  if (kwh === null || kwh === undefined) return null;
  return kwh / 1000;
}

/** "605 MWh", "2.48 GWh", "100 kWh" — picks the unit the reader expects. */
export function fmtEnergy(kwh: number | null | undefined, opts: { unit?: 'auto' | 'MWh' | 'kWh'; digits?: number } = {}): string {
  if (kwh === null || kwh === undefined || Number.isNaN(kwh)) return '—';
  const unit = opts.unit ?? 'auto';
  if (unit === 'kWh' || (unit === 'auto' && Math.abs(kwh) < 1000)) return `${fmtNumber(kwh, opts.digits ?? 0)} kWh`;
  if (unit === 'MWh' || Math.abs(kwh) < 1_000_000) return `${fmtNumber(kwh / 1000, opts.digits ?? (Math.abs(kwh) < 100_000 ? 1 : 0))} MWh`;
  return `${fmtNumber(kwh / 1_000_000, opts.digits ?? 2)} GWh`;
}

export function fmtMwh(kwh: number | null | undefined, digits = 1): string {
  if (kwh === null || kwh === undefined) return '—';
  return `${fmtNumber(kwh / 1000, digits)} MWh`;
}

export function fmtPct(p: number | null | undefined, digits = 1, signed = false): string {
  if (p === null || p === undefined || Number.isNaN(p)) return '—';
  const s = `${fmtNumber(Math.abs(p), digits)}%`;
  return signed ? (p >= 0 ? `+${s}` : `-${s}`) : (p < 0 ? `-${s}` : s);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function shortHash(h: string | null | undefined, n = 12): string {
  if (!h) return '—';
  return h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-6)}` : h;
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
