import { useEffect, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * TopLoader: A sleek, glowing progress bar and micro-sync indicator across the top
 * of the screen whenever React Query has in-flight requests or the user navigates.
 * Provides instant, high-tech visual feedback.
 */
export function TopLoader() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const location = useLocation();
  const [navigating, setNavigating] = useState(false);

  // Micro visual cue on route transition (400ms)
  useEffect(() => {
    setNavigating(true);
    const timer = setTimeout(() => setNavigating(false), 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const active = isFetching > 0 || isMutating > 0 || navigating;

  // Keep tests clean without unexpected layout noise
  if (import.meta.env.MODE === 'test' || !active) return null;

  return (
    <>
      {/* Pinned Glowing Top Progress Bar */}
      <div
        className="fixed inset-x-0 top-0 z-[9999] h-[3px] pointer-events-none overflow-hidden bg-primary-soft/40"
        aria-hidden="true"
      >
        <div className="h-full bg-gradient-to-r from-emerald-500 via-primary to-teal-300 shadow-[0_0_12px_rgba(16,185,129,0.85)] animate-top-indeterminate" />
      </div>

      {/* Floating Micro-Badge */}
      <div
        className="fixed top-3 right-4 z-[9998] flex items-center gap-1.5 rounded-full border border-line bg-surface/95 px-2.5 py-1 text-[11px] font-medium text-ink-2 shadow-card backdrop-blur pointer-events-none"
        aria-live="polite"
      >
        <Loader2 size={12} className="animate-spin text-primary" />
        <span className="tracking-tight">Verifying…</span>
      </div>
    </>
  );
}
