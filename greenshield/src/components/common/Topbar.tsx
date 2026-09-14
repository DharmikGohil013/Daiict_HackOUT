import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, Moon, Sun, UserCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { ROUTES } from '@/lib/routes';
import { SampleDataBadge } from './SampleDataBadge';
import { titleCase } from '@/lib/format';

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(() => { try { return (localStorage.getItem('greenshield.theme') as 'light' | 'dark' | null) ?? null; } catch { return null; } });
  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.setAttribute('data-theme', theme); else root.removeAttribute('data-theme');
    try { if (theme) localStorage.setItem('greenshield.theme', theme); else localStorage.removeItem('greenshield.theme'); } catch { /* ignore */ }
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}

export function Topbar({ onMenu, portal }: { onMenu: () => void; portal: string }) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur md:px-8">
      <button type="button" className="btn btn-ghost btn-sm lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu size={18} /></button>
      <div className="text-sm font-semibold text-ink-2 hidden sm:block">EcoLedger · <span className="text-ink-3 font-normal">{titleCase(portal)}</span></div>
      <SampleDataBadge />
      <div className="ml-auto flex items-center gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggle} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
        {user && (
          <div className="hidden items-center gap-2 text-sm sm:flex">
            <UserCircle2 size={18} className="text-ink-3" />
            <span className="max-w-[220px] truncate">{user.display_name || user.email}</span>
            <span className="chip bg-surface-2 text-ink-2">{user.role}{user.entity_id ? ` · ${user.entity_id}` : ''}</span>
          </div>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate(ROUTES.login); }}><LogOut size={14} /> Sign out</button>
      </div>
    </header>
  );
}
