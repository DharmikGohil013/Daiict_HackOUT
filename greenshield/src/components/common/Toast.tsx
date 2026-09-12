import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; title: string; detail?: string; tone: Tone; }
interface Ctx { push: (t: Omit<Toast, 'id'>) => void; success: (title: string, detail?: string) => void; error: (title: string, detail?: string) => void; warn: (title: string, detail?: string) => void; }

const ToastContext = createContext<Ctx | null>(null);
const icon: Record<Tone, ReactNode> = { success: <CheckCircle2 size={16} className="text-low" />, error: <XCircle size={16} className="text-critical" />, warning: <AlertTriangle size={16} className="text-medium" />, info: <Info size={16} className="text-info" /> };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const remove = useCallback((id: number) => setItems((s) => s.filter((t) => t.id !== id)), []);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { ...t, id }]);
    setTimeout(() => remove(id), t.tone === 'error' ? 7000 : 4500);
  }, [remove]);
  const value = useMemo<Ctx>(() => ({ push, success: (title, detail) => push({ title, detail, tone: 'success' }), error: (title, detail) => push({ title, detail, tone: 'error' }), warn: (title, detail) => push({ title, detail, tone: 'warning' }) }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn('pointer-events-auto panel flex items-start gap-3 px-4 py-3 shadow-pop')}>
            <span className="mt-0.5">{icon[t.tone]}</span>
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{t.title}</div>{t.detail && <div className="mt-0.5 text-xs text-ink-2">{t.detail}</div>}</div>
            <button type="button" className="text-ink-3 hover:text-ink" onClick={() => remove(t.id)} aria-label="Dismiss"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
