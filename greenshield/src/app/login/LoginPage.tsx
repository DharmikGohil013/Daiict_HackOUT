import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { authApi } from '@/services';
import { useAuth } from '@/lib/auth';
import { homeForRole, ROUTES } from '@/lib/routes';
import { Field } from '@/components/common/FilterBar';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';
import type { ApiError, Role } from '@/types';

type LoginRole = 'government' | 'generator' | 'institution' | 'issuer';
const ROLES: Array<{ value: LoginRole; label: string }> = [
  { value: 'government', label: 'Government' }, { value: 'generator', label: 'Generator' }, { value: 'institution', label: 'Institution' }, { value: 'issuer', label: 'REC Issuer' },
];

export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<LoginRole>((params.get('role') as LoginRole) || 'government');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finish = (userRole: Role) => navigate(location.state?.from && location.state.from !== ROUTES.login ? location.state.from : homeForRole(userRole), { replace: true });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('login'); setError(null);
    try {
      const s = await authApi.login(email.trim(), password, role);
      setSession(s);
      finish(s.user.role);
    } catch (err) {
      setError((err as ApiError).message);
    } finally { setBusy(null); }
  };

  const demo = async (r: LoginRole) => {
    setBusy(r); setError(null);
    try {
      const s = await authApi.demo(r);
      setSession(s);
      finish(s.user.role);
    } catch (err) {
      setError((err as ApiError).message);
    } finally { setBusy(null); }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <Link to={ROUTES.landing} className="mb-6 flex items-center gap-3 text-ink no-underline"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-fg"><ShieldCheck size={22} /></span><span><span className="block font-display text-xl font-semibold leading-none">GreenShield</span><span className="mt-1 block text-xs text-ink-3">Renewable energy verification portal</span></span></Link>
        <form onSubmit={submit} className="panel panel-pad space-y-4" aria-label="Sign in">
          <div className="flex items-center justify-between"><h1 className="text-xl">Sign in</h1><SampleDataBadge /></div>
          <Field id="email" label="Email"><input id="email" className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="officer@ministry.gov.in" required /></Field>
          <Field id="password" label="Password"><input id="password" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></Field>
          <Field id="role" label="Role"><select id="role" className="field" value={role} onChange={(e) => setRole(e.target.value as LoginRole)}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
          {error && <p role="alert" className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy !== null}>{busy === 'login' ? 'Signing in…' : 'Sign In'}</button>
          <div className="relative py-1 text-center text-[11px] uppercase tracking-wider text-ink-3"><span className="bg-surface px-2">or explore with demo accounts</span><span className="absolute inset-x-0 top-1/2 -z-10 border-t border-line" /></div>
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" className="btn btn-secondary" onClick={() => demo('government')} disabled={busy !== null}>{busy === 'government' ? '…' : 'Demo Government'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => demo('generator')} disabled={busy !== null}>{busy === 'generator' ? '…' : 'Demo Generator'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => demo('institution')} disabled={busy !== null}>{busy === 'institution' ? '…' : 'Demo Institution'}</button>
          </div>
          <button type="button" className="btn btn-ghost w-full text-xs" onClick={() => demo('issuer')} disabled={busy !== null}>Demo REC Issuer</button>
          <p className="text-center text-xs text-ink-3">Public certificate verification needs no account — <Link to={ROUTES.verifier}>open the REC verifier</Link>.</p>
        </form>
      </div>
    </div>
  );
}
