'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id:       string;
  variant:  ToastVariant;
  title:    string;
  message?: string;
  /** ms before auto-dismiss. Default: 4500. Pass 0 to disable. */
  duration?: number;
}

type ToastInput = Omit<ToastItem, 'id'>;

interface ToastContextValue {
  toast:   (input: ToastInput)         => void;
  success: (title: string, message?: string) => void;
  error:   (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info:    (title: string, message?: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Styles map ───────────────────────────────────────────────────────────────
const STYLES: Record<ToastVariant, { bg: string; border: string; icon: string; iconEl: React.ReactNode }> = {
  success: {
    bg:     'bg-white',
    border: 'border-l-4 border-l-emerald-500',
    icon:   'text-emerald-500',
    iconEl: <CheckCircle2 className="h-5 w-5 shrink-0" />,
  },
  error: {
    bg:     'bg-white',
    border: 'border-l-4 border-l-red-500',
    icon:   'text-red-500',
    iconEl: <XCircle className="h-5 w-5 shrink-0" />,
  },
  warning: {
    bg:     'bg-white',
    border: 'border-l-4 border-l-amber-400',
    icon:   'text-amber-500',
    iconEl: <AlertTriangle className="h-5 w-5 shrink-0" />,
  },
  info: {
    bg:     'bg-white',
    border: 'border-l-4 border-l-blue-500',
    icon:   'text-blue-500',
    iconEl: <Info className="h-5 w-5 shrink-0" />,
  },
};

// ─── Single toast item ────────────────────────────────────────────────────────
function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const s = STYLES[item.variant];
  const duration = item.duration ?? 4500;

  // Animate in
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (duration === 0) return;
    const t = setTimeout(() => dismiss(), duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  function dismiss() {
    setVisible(false);
    setTimeout(() => onDismiss(item.id), 300); // wait for fade-out
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl shadow-lg px-4 py-3',
        'border border-slate-100',
        s.bg,
        s.border,
        'transition-all duration-300 ease-out',
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6',
      ].join(' ')}
    >
      <span className={s.icon}>{s.iconEl}</span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 leading-snug">{item.title}</p>
        {item.message && (
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{item.message}</p>
        )}
      </div>

      <button
        onClick={dismiss}
        className="shrink-0 rounded-md p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="Cerrar notificación"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Toaster stack (renders near bottom-right) ────────────────────────────────
function Toaster({ items, dismiss }: { items: ToastItem[]; dismiss: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div
      aria-label="Notificaciones"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = `toast-${Date.now()}-${++counter.current}`;
    setItems((prev) => [...prev, { ...input, id }]);
  }, []);

  const success = useCallback((title: string, message?: string) =>
    toast({ variant: 'success', title, message }), [toast]);

  const error = useCallback((title: string, message?: string) =>
    toast({ variant: 'error', title, message, duration: 6000 }), [toast]);

  const warning = useCallback((title: string, message?: string) =>
    toast({ variant: 'warning', title, message }), [toast]);

  const info = useCallback((title: string, message?: string) =>
    toast({ variant: 'info', title, message }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      <Toaster items={items} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}
