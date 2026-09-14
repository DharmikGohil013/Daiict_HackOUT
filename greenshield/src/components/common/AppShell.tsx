import { useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, type NavItem } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({ nav, portal, children }: { nav: NavItem[]; portal: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar nav={nav} portal={portal} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setOpen(true)} portal={portal} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8">
          <div key={location.pathname} className="page-enter">
            {children ?? <Outlet />}
          </div>
        </main>
        <footer className="border-t border-line px-4 py-3 text-xs text-ink-3 md:px-8">
          EcoLedger · AI-Powered Renewable Energy Verification &amp; Fraud Intelligence
        </footer>
      </div>
    </div>
  );
}
