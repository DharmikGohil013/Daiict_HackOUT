import { Link } from 'react-router-dom';
import { ArrowRight, Brain, FileCheck2, ShieldCheck, Landmark, Copy, ScrollText, Radar } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { SampleDataBadge } from '@/components/common/SampleDataBadge';

const FEATURES = [
  { icon: Brain, title: 'AI Generation Prediction', text: 'Weather, capacity, location and history estimate what each plant could really have produced.' },
  { icon: FileCheck2, title: 'REC Certificate Security', text: 'SHA-256 hash, RSA-2048 signature and a steganographic payload hidden inside every certificate file.' },
  { icon: Copy, title: 'Duplicate Claim Prevention', text: 'Each REC has one immutable identity and one atomic claim state in the shared ledger.' },
  { icon: Radar, title: 'Fraud Detection', text: 'Rules, AI and cryptography combine into one transparent 0–100 risk score with explanations.' },
  { icon: Landmark, title: 'Government Verification', text: 'Officers see claimed vs expected vs actual, evidence and certificate checks on one screen.' },
  { icon: ScrollText, title: 'Tamper-Evident Audit Trail', text: 'Every step is hash-chained; altering history breaks the chain and is detected.' },
];
const FLOW = ['Generate', 'Predict', 'Issue REC', 'Verify', 'Detect Fraud', 'Government Decision'];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-fg"><ShieldCheck size={20} /></span><span className="font-display text-xl font-semibold">GreenShield</span><SampleDataBadge /></div>
        <nav className="flex items-center gap-2 text-sm"><Link className="btn btn-ghost btn-sm" to={ROUTES.verifier}>Verify a certificate</Link><Link className="btn btn-primary btn-sm" to={ROUTES.login}>Sign in</Link></nav>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-10 md:pt-16">
        <div className="label mb-3 text-primary">AI-Powered Renewable Energy Verification &amp; REC Fraud Intelligence</div>
        <h1 className="max-w-3xl text-4xl leading-[1.08] md:text-5xl">AI-Powered Renewable Energy Verification</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-2">Verify renewable energy claims, predict generation, detect certificate tampering, and prevent duplicate REC claims.</p>
        <p className="mt-2 font-display text-base italic text-ink-2">Don't trust the claim. Verify it against reality.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={`${ROUTES.login}?role=government`} className="btn btn-primary">Government Login <ArrowRight size={16} /></Link>
          <Link to={`${ROUTES.login}?role=generator`} className="btn btn-secondary">Generator Login</Link>
          <Link to={`${ROUTES.login}?role=institution`} className="btn btn-secondary">Institution Login</Link>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <ol className="flex flex-wrap items-center gap-2 rounded-xl2 border border-line bg-surface px-4 py-4 text-sm">
          {FLOW.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className="rounded-full bg-primary-soft px-3 py-1 font-semibold text-primary">{s}</span>
              {i < FLOW.length - 1 && <ArrowRight size={14} className="text-ink-3" />}
            </li>
          ))}
        </ol>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="panel panel-pad">
            <f.icon size={20} className="text-primary" />
            <h3 className="mt-3 text-base">{f.title}</h3>
            <p className="mt-1 text-sm text-ink-2">{f.text}</p>
          </article>
        ))}
      </section>
      <footer className="border-t border-line px-6 py-6 text-center text-xs text-ink-3">GreenShield · Three independent questions, one government verification decision.</footer>
    </div>
  );
}
