import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Activity, FileBadge2, Gavel, Repeat } from 'lucide-react';
import { useClaim, useDecideClaim, usePlant } from '@/lib/queries';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { RiskBadge } from '@/components/common/RiskBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Kv } from '@/components/common/Kv';
import { Panel } from '@/components/common/Panel';
import { Timeline } from '@/components/common/Timeline';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { EnergyComparisonCard } from '@/components/claims/EnergyComparisonCard';
import { AiExplanationCard } from '@/components/claims/AiExplanationCard';
import { SecurityVerificationCard, checksFromSecurity } from '@/components/security/SecurityVerificationCard';
import { RiskGauge } from '@/components/charts/RiskGauge';
import { ChartCard } from '@/components/charts/ChartCard';
import { LineChart } from '@/components/charts/LineChart';
import { chartColor } from '@/components/charts/palette';
import { WeatherCard } from '@/components/dashboard/WeatherCard';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime, fmtEnergy, fmtNumber, fmtPct, fmtTime, titleCase } from '@/lib/format';
import { FRAUD_TYPE_LABEL } from '@/lib/risk';
import { ROUTES } from '@/lib/routes';
import type { ApiError, Claim, Decision, Evidence, PlantProfile, WeatherDay } from '@/types';

type Tone = 'low' | 'medium' | 'high' | 'critical';
const toneCls: Record<Tone, string> = { low: 'border-low/40 bg-low-soft text-low', medium: 'border-medium/40 bg-medium-soft text-medium', high: 'border-high/40 bg-high-soft text-high', critical: 'border-critical/40 bg-critical-soft text-critical' };

/** FinalMD §54 — the three independent questions a judge must see answered without scrolling. */
function threeQuestions(claim: Claim): Array<{ q: string; answer: string; detail: string; tone: Tone; icon: typeof Activity }> {
  const dev = claim.deviation_pct;
  const devActual = claim.actual_kwh ? ((claim.claimed_kwh - claim.actual_kwh) / claim.actual_kwh) * 100 : null;
  const genTone: Tone = dev == null ? 'medium' : dev > 40 ? 'critical' : dev > 15 ? 'high' : 'low';
  const cert = claim.certificate_status;
  const certTone: Tone = cert === 'VALID' ? 'low' : cert === 'NOT_PROVIDED' ? 'medium' : cert === 'NOT_FOUND' || cert === 'REVOKED' ? 'high' : 'critical';
  const ledger = claim.ledger_record;
  const claimedElsewhere = ledger?.status === 'claimed' && ledger.claimed_by !== claim.institution_id;
  const dupTone: Tone = cert === 'DUPLICATE' || claimedElsewhere ? 'critical' : ledger ? 'low' : 'medium';
  return [
    {
      q: 'Did the plant actually generate this much energy?', icon: Activity, tone: genTone,
      answer: dev == null ? 'Unknown' : dev > 40 ? 'No — far above expectation' : dev > 15 ? 'Doubtful' : 'Yes — consistent',
      detail: dev == null ? 'No AI expectation available.' : `${fmtPct(dev, 1, true)} vs AI expected${devActual != null ? `, ${fmtPct(devActual, 1, true)} vs metered actual` : ''}.`,
    },
    {
      q: 'Is the REC certificate authentic and untampered?', icon: FileBadge2, tone: certTone,
      answer: cert === 'VALID' ? 'Yes — authentic' : cert === 'NOT_PROVIDED' ? 'Ledger check only' : cert === 'TAMPERED' ? 'No — tampered' : cert === 'ID_TAMPERED' ? 'No — ID tampering' : cert === 'NOT_FOUND' ? 'Not registered' : cert === 'REVOKED' ? 'Revoked' : cert === 'DUPLICATE' ? 'Authentic, already used' : 'Not verified',
      detail: claim.fraud_score?.certificate?.reason ?? (cert === 'NOT_PROVIDED' ? 'No certificate file was uploaded with this claim.' : 'Steganography → SHA-256 → RSA → ledger.'),
    },
    {
      q: 'Has this REC already been claimed?', icon: Repeat, tone: dupTone,
      answer: cert === 'DUPLICATE' || claimedElsewhere ? 'Yes — duplicate' : ledger?.status === 'claimed' ? 'Claimed by this claim' : ledger ? 'No — first claim' : 'No ledger record',
      detail: ledger?.claimed_by ? `Claimed by ${ledger.claimed_by} on ${fmtDate(ledger.claimed_at)}.` : ledger ? `Ledger status ${ledger.status}; certificate ${ledger.cert_id} issued ${fmtDate(ledger.issued_at)}.` : `${claim.cert_id} is not in the REC ledger.`,
    },
  ];
}

/** Plain-language guidance for the officer (FinalMD §55: "What should the government do?"). */
function recommendation(claim: Claim): { title: string; body: string; tone: Tone } {
  if (claim.status === 'approved') return { title: 'Approved', body: `${claim.decided_by ?? 'An officer'} approved this claim on ${fmtDateTime(claim.decided_at)}. The certificate is marked as claimed by ${claim.institution_id}.`, tone: 'low' };
  if (claim.status === 'rejected') return { title: claim.decision === 'duplicate_blocked' ? 'Blocked automatically' : 'Rejected', body: claim.decision_note ?? 'This claim was rejected.', tone: 'critical' };
  const cert = claim.certificate_status;
  if (cert === 'TAMPERED' || cert === 'ID_TAMPERED') return { title: 'Reject — certificate integrity failed', body: 'The signed payload does not match the document. Reject the claim and consider referring the institution; the original certificate holder should be notified.', tone: 'critical' };
  if (cert === 'NOT_FOUND') return { title: 'Reject unless a registered certificate is produced', body: 'The certificate ID is not in the national REC ledger. Request the original certificate file; approve only after it verifies.', tone: 'high' };
  if (cert === 'REVOKED') return { title: 'Reject — certificate revoked', body: 'The regulator revoked this certificate; it cannot support a claim.', tone: 'high' };
  if (claim.risk_level === 'CRITICAL' || claim.risk_level === 'HIGH') return { title: 'Request evidence or reject', body: `Claimed energy is ${fmtPct(claim.deviation_pct, 1, true)} above the AI expectation${claim.actual_kwh != null ? ` and ${fmtEnergy(claim.claimed_kwh - claim.actual_kwh)} above the meter` : ''}. Ask for meter logs and O&M reports; reject if they do not close the gap.`, tone: claim.risk_level === 'CRITICAL' ? 'critical' : 'high' };
  if (claim.status === 'evidence_requested') return { title: 'Awaiting evidence', body: 'The institution has been asked for supporting documents. Decide once they arrive.', tone: 'medium' };
  return { title: 'No action needed', body: `Risk ${claim.risk_score ?? 0}/100 — the claim was ${claim.status === 'verified' ? 'auto-verified' : 'accepted'} and the certificate is marked as claimed.`, tone: 'low' };
}

function periodSeries(claim: Claim, evidence: Evidence | null | undefined, profile: PlantProfile | undefined) {
  if (evidence && evidence.predictions.length) {
    const actual = new Map(evidence.generation.map((g) => [g.date, g.actual_kwh]));
    return evidence.predictions.map((p) => ({ date: p.date, predicted: p.predicted_kwh, lower: p.lower, upper: p.upper, actual: actual.get(p.date) ?? null }));
  }
  if (profile) {
    const from = new Date(`${claim.period_start}T00:00:00`); from.setDate(from.getDate() - 15);
    const to = new Date(`${claim.period_end}T00:00:00`); to.setDate(to.getDate() + 15);
    return profile.series.filter((s) => { const d = new Date(`${s.date}T00:00:00`); return d >= from && d <= to; }).map((s) => ({ date: s.date, predicted: s.predicted_kwh, lower: s.lower, upper: s.upper, actual: s.actual_kwh }));
  }
  return [];
}

function periodWeather(claim: Claim, evidence: Evidence | null | undefined, profile: PlantProfile | undefined): { days: WeatherDay[]; avg: WeatherDay | null } {
  const rows: WeatherDay[] = evidence?.weather?.length ? evidence.weather : (profile?.series ?? []).map((s) => ({ date: s.date, temperature_c: s.temperature_c ?? null, humidity_pct: s.humidity_pct ?? null, cloud_cover_pct: s.cloud_cover_pct ?? null, solar_irradiance_kwh_m2: s.solar_irradiance_kwh_m2 ?? null, wind_speed_ms: s.wind_speed_ms ?? null }));
  const inPeriod = rows.filter((w) => w.date && w.date >= claim.period_start && w.date <= claim.period_end);
  const mean = (k: keyof WeatherDay) => { const v = inPeriod.map((w) => w[k]).filter((x): x is number => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const avg = inPeriod.length ? { temperature_c: mean('temperature_c'), humidity_pct: mean('humidity_pct'), cloud_cover_pct: mean('cloud_cover_pct'), solar_irradiance_kwh_m2: mean('solar_irradiance_kwh_m2'), wind_speed_ms: mean('wind_speed_ms') } : null;
  return { days: rows, avg };
}

export default function ClaimDetailPage() {
  const { id } = useParams();
  const q = useClaim(id);
  const decide = useDecideClaim();
  const toast = useToast();
  const [dialog, setDialog] = useState<Decision | null>(null);
  const evidence = q.data?.evidence ?? null;
  // Claims without an investigation carry no evidence bundle → fall back to the plant profile series.
  const profileQ = usePlant(q.data && !evidence ? q.data.claim.plant_id : undefined, 90);
  const series = useMemo(() => (q.data ? periodSeries(q.data.claim, evidence, profileQ.data) : []), [q.data, evidence, profileQ.data]);
  const weather = useMemo(() => (q.data ? periodWeather(q.data.claim, evidence, profileQ.data) : { days: [], avg: null }), [q.data, evidence, profileQ.data]);

  if (q.isLoading) return <LoadingState label="Loading claim…" />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { claim, audit, investigation } = q.data;
  const score = claim.fraud_score;
  const decidable = !['approved', 'rejected'].includes(claim.status);
  const questions = threeQuestions(claim);
  const advice = recommendation(claim);
  const inPeriod = series.filter((s) => s.date >= claim.period_start && s.date <= claim.period_end);
  const periodActual = inPeriod.reduce((a, s) => a + (s.actual ?? 0), 0);
  const periodPredicted = inPeriod.reduce((a, s) => a + (s.predicted ?? 0), 0);
  const isWind = claim.energy_type === 'Wind';

  const run = async (note?: string) => {
    if (!dialog) return;
    try {
      await decide.mutateAsync({ id: claim.claim_id, decision: dialog, note });
      toast.success(`Claim ${claim.claim_id} — ${titleCase(dialog)}`, 'Recorded in the audit trail.');
      setDialog(null);
    } catch (e) { toast.error('Decision failed', (e as ApiError).message); }
  };

  return (
    <>
      <PageHeader eyebrow={<Link to={ROUTES.government.claims}>← Claims</Link>} title={<>Claim Verification — <span className="font-mono">{claim.cert_id}</span></>} subtitle={`${claim.claim_id} · ${claim.institution_name ?? claim.institution_id} claims ${fmtEnergy(claim.claimed_kwh)} from ${claim.plant_name ?? claim.plant_id}`}
        actions={<>
          <StatusBadge status={claim.status} kind="claim" />
          {claim.case_id && <Link className="btn btn-secondary btn-sm" to={ROUTES.government.investigation(claim.case_id)}>Open investigation {claim.case_id}</Link>}
          {decidable && <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog('request_evidence')}>Request more data</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setDialog('reject')}>Reject</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setDialog('approve')} disabled={!['VALID', 'NOT_PROVIDED', null].includes(claim.certificate_status)}>Approve</button>
          </>}
        </>} />

      {/* Three independent questions — the verdict strip */}
      <div className="mb-4 grid gap-3 md:grid-cols-3" data-testid="three-questions">
        {questions.map((x) => (
          <div key={x.q} className={cn('rounded-xl2 border px-4 py-3', toneCls[x.tone])}>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80"><x.icon size={14} />{x.q}</div>
            <div className="mt-1 font-display text-lg font-semibold">{x.answer}</div>
            <div className="mt-0.5 text-xs opacity-90">{x.detail}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        <Panel>
          <Kv cols={4} items={[
            { label: 'Generator', value: <>{claim.plant_id}<span className="block text-xs font-normal text-ink-3">{claim.plant_name} · {claim.energy_type} · {claim.capacity_mw} MW</span></> },
            { label: 'Institution', value: <>{claim.institution_id}<span className="block text-xs font-normal text-ink-3">{claim.institution_name}</span></> },
            { label: 'Certificate', value: <Link to={ROUTES.government.certificate(claim.cert_id)} className="font-mono">{claim.cert_id}</Link> },
            { label: 'Generation period', value: `${fmtDate(claim.period_start)} – ${fmtDate(claim.period_end)}` },
            { label: 'Claimed', value: <span className="text-critical">{fmtEnergy(claim.claimed_kwh)}</span> },
            { label: 'AI expected', value: <>{fmtEnergy(claim.expected_kwh)}<span className="block text-xs font-normal text-ink-3">{claim.expected_lower_kwh != null ? `${fmtEnergy(claim.expected_lower_kwh)} – ${fmtEnergy(claim.expected_upper_kwh)}` : ''}</span></> },
            { label: 'Actual', value: fmtEnergy(claim.actual_kwh) },
            { label: 'Difference', value: claim.actual_kwh != null ? <span className={claim.claimed_kwh - claim.actual_kwh > 0 ? 'text-critical' : ''}>{claim.claimed_kwh - claim.actual_kwh > 0 ? '+' : ''}{fmtEnergy(claim.claimed_kwh - claim.actual_kwh)}</span> : '—' },
            { label: 'Fraud type', value: FRAUD_TYPE_LABEL[claim.fraud_type ?? 'none'] },
            { label: 'Transaction', value: claim.transaction_id ?? '—', mono: true },
            { label: 'Submitted', value: fmtDateTime(claim.submitted_at) },
            { label: 'Decision', value: claim.decision ? `${titleCase(claim.decision)}${claim.decided_by ? ` · ${claim.decided_by}` : ''}` : 'Pending' },
          ]} />
          {claim.decision_note && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">{claim.decision_note}</p>}
        </Panel>
        <div className="grid gap-4">
          <Panel className="flex flex-col items-center justify-center gap-2">
            <RiskGauge score={claim.risk_score ?? 0} level={claim.risk_level} thresholds={score?.thresholds} size={170} />
            <RiskBadge score={claim.risk_score} level={claim.risk_level} size="lg" />
          </Panel>
          <div className={cn('rounded-xl2 border px-4 py-3', toneCls[advice.tone])} data-testid="recommendation">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80"><Gavel size={14} />What should the government do?</div>
            <div className="mt-1 font-display text-base font-semibold">{advice.title}</div>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{advice.body}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <EnergyComparisonCard claimed={claim.claimed_kwh} expected={claim.expected_kwh} actual={claim.actual_kwh} range={{ lower: claim.expected_lower_kwh, upper: claim.expected_upper_kwh }} />
        <SecurityVerificationCard checks={score?.certificate?.checks ?? checksFromSecurity(claim.certificate_security)} result={claim.certificate_status} claimedBy={claim.ledger_record?.claimed_by} reason={score?.certificate?.reason} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {score ? <AiExplanationCard score={score} /> : <Panel title="Why was this claim flagged?"><p className="text-sm text-ink-3">No fraud score recorded for this claim.</p></Panel>}
        <ChartCard title="Generation vs AI prediction" subtitle={`Metered output against the 10–90% prediction band · claim period ${fmtDate(claim.period_start)} – ${fmtDate(claim.period_end)} ± 15 days`} legend={[{ label: 'Actual (meter)', color: chartColor.actual }, { label: 'AI predicted', color: chartColor.expected, dashed: true }]}>
          {series.length ? (
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1"><LineChart data={series} xKey="date" series={[{ key: 'actual', label: 'Actual', color: chartColor.actual }, { key: 'predicted', label: 'AI predicted', color: chartColor.expected, dashed: true }]} band={{ lowKey: 'lower', highKey: 'upper' }} yFormatter={(v) => fmtEnergy(v)} xFormatter={(d) => d.slice(5)} /></div>
              {inPeriod.length > 0 && <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-2 text-xs text-ink-2"><span>In period · predicted <b className="num">{fmtEnergy(periodPredicted)}</b></span><span>metered <b className="num">{fmtEnergy(periodActual)}</b></span><span>claimed <b className="num text-critical">{fmtEnergy(claim.claimed_kwh)}</b></span><span>{inPeriod.length} day(s)</span></div>}
            </div>
          ) : profileQ.isLoading ? <LoadingState label="Loading generation series…" /> : <p className="text-sm text-ink-3">No generation data recorded for this plant around the claim period.</p>}
        </ChartCard>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <ChartCard title="Weather evidence" subtitle={isWind ? 'Wind speed and humidity through the period' : 'Solar irradiance and cloud cover through the period'} legend={isWind ? [{ label: 'Wind m/s', color: chartColor.info }, { label: 'Humidity %', color: chartColor.accent, dashed: true }] : [{ label: 'Irradiance kWh/m²', color: chartColor.accent }, { label: 'Cloud cover % ÷ 10', color: chartColor.info, dashed: true }]}>
          {weather.days.length ? (
            <LineChart data={weather.days.filter((w) => w.date).map((w) => ({ date: w.date, a: isWind ? w.wind_speed_ms : w.solar_irradiance_kwh_m2, b: isWind ? w.humidity_pct : (w.cloud_cover_pct ?? 0) / 10 }))} xKey="date" series={isWind ? [{ key: 'a', label: 'Wind', color: chartColor.info }, { key: 'b', label: 'Humidity', color: chartColor.accent, dashed: true }] : [{ key: 'a', label: 'Irradiance', color: chartColor.accent }, { key: 'b', label: 'Cloud ÷10', color: chartColor.info, dashed: true }]} xFormatter={(d) => d.slice(5)} yFormatter={(v) => fmtNumber(v, 1)} />
          ) : <p className="text-sm text-ink-3">No weather observations for this period.</p>}
        </ChartCard>
        <WeatherCard weather={weather.avg} date={`${claim.period_start} → ${claim.period_end}`} title="Period average weather" />
      </div>

      <Panel title="Tamper-evident audit trail" subtitle={investigation ? `Investigation ${investigation.case_id} · ${investigation.assigned_officer ?? 'unassigned'} · ${titleCase(investigation.status)}` : 'Every step of this verification, hash-chained'}>
        <Timeline compact items={audit.map((e) => ({ id: e.id, time: fmtTime(e.timestamp), title: e.action, actor: e.actor, detail: e.detail, tone: /reject|blocked|MISMATCH|INVALID|NOT found/i.test(e.action) ? 'critical' : /approved|verified|marked/i.test(e.action) ? 'low' : 'info' }))} />
      </Panel>

      <ConfirmDialog open={dialog !== null} onClose={() => setDialog(null)} onConfirm={run} busy={decide.isPending}
        title={dialog === 'approve' ? 'Approve claim' : dialog === 'reject' ? 'Reject claim' : 'Request more data'}
        message={dialog === 'approve' ? `Approving ${claim.claim_id} will mark certificate ${claim.cert_id} as claimed by ${claim.institution_id}. This is atomic — if the certificate was claimed elsewhere first, the claim is rejected as a duplicate.` : dialog === 'reject' ? `Reject ${claim.claim_id}? The institution and generator will see the decision; the audit trail records who decided and why.` : `Ask ${claim.institution_id} for meter logs, O&M reports or other evidence before deciding.`}
        confirmLabel={dialog === 'approve' ? 'Approve' : dialog === 'reject' ? 'Reject claim' : 'Request evidence'} tone={dialog === 'reject' ? 'danger' : 'primary'} withNote />
    </>
  );
}
