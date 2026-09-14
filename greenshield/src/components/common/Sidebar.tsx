import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { Leaf, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; group?: string; }

export function Sidebar({ nav, portal, open, onClose }: { nav: NavItem[]; portal: string; open: boolean; onClose: () => void }) {
  // Build a list of items with group separators injected
  const renderedGroups: string[] = [];

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={onClose} />}
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:static lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
          <NavLink to={ROUTES.landing} className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-fg shadow-sm" aria-label="EcoLedger home">
            <Leaf size={20} />
          </NavLink>
          <div className="min-w-0">
            <div className="font-display text-base font-bold leading-none text-ink">EcoLedger</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-ink-3">{portal} portal</div>
          </div>
          <button type="button" className="ml-auto text-ink-3 lg:hidden" onClick={onClose} aria-label="Close menu"><X size={18} /></button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5" aria-label="Primary">
          {nav.map((n) => {
            const showGroup = n.group && !renderedGroups.includes(n.group);
            if (n.group && showGroup) renderedGroups.push(n.group);
            return (
              <Fragment key={n.to}>
                {showGroup && (
                  <div className="px-3 pt-4 pb-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-3">{n.group}</span>
                  </div>
                )}
                <NavLink to={n.to} end={n.end} onClick={onClose}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 transition-all duration-150',
                    isActive ? 'bg-primary-soft text-primary font-semibold' : 'hover:bg-surface-2 hover:text-ink'
                  )}
                >
                  <n.icon size={16} className="shrink-0" />
                  <span className="truncate">{n.label}</span>
                </NavLink>
              </Fragment>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-line">
          <p className="text-[11px] leading-relaxed text-ink-3">REC integrity: steganography · RSA · ledger</p>
        </div>
      </aside>
    </>
  );
}
