import { NavLink } from 'react-router-dom';
import { ShieldCheck, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; }

export function Sidebar({ nav, portal, open, onClose }: { nav: NavItem[]; portal: string; open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={onClose} />}
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:static lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-3 px-5 py-5">
          <NavLink to={ROUTES.landing} className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-fg" aria-label="GreenShield home"><ShieldCheck size={20} /></NavLink>
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold leading-none">GreenShield</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.08em] text-ink-3">{portal} portal</div>
          </div>
          <button type="button" className="ml-auto text-ink-3 lg:hidden" onClick={onClose} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Primary">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={onClose} className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 transition', isActive ? 'bg-primary-soft text-primary' : 'hover:bg-surface-2 hover:text-ink')}>
              <n.icon size={17} />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-[11px] leading-relaxed text-ink-3">
          Three independent questions:<br />Did the plant generate it? · Is the REC authentic? · Was it already claimed?
        </div>
      </aside>
    </>
  );
}
