// Small design-system kit (shadcn/ui conventions on Tailwind v4).
import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, ChevronDown, Info, Loader2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { appZoom, onAppZoom, stepAppZoom, unzoom } from './zoom';

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white shadow-soft hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-300',
  secondary: 'bg-zinc-900 text-white shadow-soft hover:bg-zinc-800 disabled:bg-zinc-400',
  outline: 'border border-zinc-200 bg-white text-zinc-800 shadow-soft hover:bg-zinc-50 hover:border-zinc-300 disabled:text-zinc-400',
  ghost: 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 disabled:text-zinc-300 disabled:hover:bg-transparent',
  subtle: 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 disabled:text-zinc-400',
  danger: 'bg-red-600 text-white shadow-soft hover:bg-red-500 disabled:bg-red-300',
};
const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12.5px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-lg',
  icon: 'h-9 w-9 rounded-lg',
  'icon-sm': 'h-7 w-7 rounded-md',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; loading?: boolean; active?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'outline', size = 'md', loading, active, className, children, disabled, type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading}
      className={cn('inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors select-none', VARIANTS[variant], SIZES[size], active && 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800', className)} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

/** Icon-only button; `label` becomes the tooltip and accessible name. */
export const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps & { label: string; shortcut?: string }>(function IconButton({ label, shortcut, size = 'icon-sm', variant = 'ghost', ...rest }, ref) {
  return <Button ref={ref} aria-label={label} title={shortcut ? `${label} (${shortcut})` : label} size={size} variant={variant} {...rest} />;
});

/* ---------- Inputs ---------- */
export const inputClass = 'h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-soft placeholder:text-zinc-400 transition-colors hover:border-zinc-300 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:bg-zinc-50 disabled:text-zinc-400';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...rest} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(inputClass, 'h-auto min-h-16 py-2 leading-relaxed', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(inputClass, 'appearance-none pr-8')} {...rest}>{children}</select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
    </div>
  );
}

export function Label({ className, ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-medium text-zinc-700', className)} {...rest} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500">{children}</kbd>;
}

export function Badge({ children, tone = 'zinc', className }: { children: React.ReactNode; tone?: 'zinc' | 'indigo' | 'green' | 'amber' | 'red'; className?: string }) {
  const tones = { zinc: 'bg-zinc-100 text-zinc-600', indigo: 'bg-indigo-50 text-indigo-700', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-800', red: 'bg-red-50 text-red-700' };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', tones[tone], className)}>{children}</span>;
}

export const Separator = ({ vertical, className }: { vertical?: boolean; className?: string }) =>
  <div role="separator" className={cn(vertical ? 'mx-1 h-5 w-px' : 'my-1 h-px w-full', 'shrink-0 bg-zinc-200', className)} />;

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('size-4 animate-spin text-zinc-400', className)} />;

/* ---------- Dialog ---------- */
export function Dialog({ open, onClose, title, description, children, footer, width = 'max-w-lg' }: {
  open: boolean; onClose: () => void; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; width?: string;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button:not([data-close])');
      first?.focus();
    });
    return () => { window.removeEventListener('keydown', onKey, true); prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/40 p-4 pt-[10vh] backdrop-blur-[2px]" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={id} className={cn('w-full animate-in rounded-xl border border-zinc-200 bg-white shadow-pop', width)}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 id={id} className="text-base font-semibold tracking-tight text-zinc-950">{title}</h2>
            {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
          </div>
          <IconButton data-close label="Close" onClick={onClose} className="-mr-2 -mt-1"><X className="size-4" /></IconButton>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-xl border-t border-zinc-100 bg-zinc-50/60 px-6 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Promise-based confirm dialog. */
type ConfirmOpts = { title: string; description?: React.ReactNode; confirm?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>(resolve => setState({ ...o, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog open={!!state} onClose={() => close(false)} title={state?.title} description={state?.description} width="max-w-md"
        footer={<><Button onClick={() => close(false)}>Cancel</Button><Button data-autofocus variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state?.confirm || 'Confirm'}</Button></>} />
    </ConfirmCtx.Provider>
  );
}

/* ---------- Menu (dropdown) ---------- */
export interface MenuItem { label: string; icon?: React.ReactNode; onSelect?: () => void; danger?: boolean; disabled?: boolean; hint?: string; separator?: boolean; heading?: boolean }

export function Menu({ trigger, items, align = 'start', width = 'w-60' }: { trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => React.ReactNode; items: MenuItem[]; align?: 'start' | 'end'; width?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    const w = list.current?.offsetWidth || 240;
    const vw = unzoom(window.innerWidth);
    const left = align === 'end' ? Math.max(8, unzoom(r.right) - w) : Math.min(unzoom(r.left), vw - w - 8);
    setPos({ top: unzoom(r.bottom) + 4, left });
  }, [open, align]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node) && !list.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={wrap} className="relative inline-flex">
      {trigger({ onClick: () => setOpen(o => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {open && createPortal(
        <div ref={list} role="menu" style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
          className={cn('fixed z-50 max-h-[70vh] animate-in overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-pop sv-scroll', width)}>
          {items.map((item, i) => item.separator ? <Separator key={i} /> : item.heading ? (
            <div key={i} className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{item.label}</div>
          ) : (
            <button key={i} role="menuitem" disabled={item.disabled}
              onClick={() => { setOpen(false); item.onSelect?.(); }}
              className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] outline-none transition-colors focus:bg-zinc-100 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent',
                item.danger ? 'text-red-600 focus:bg-red-50 hover:bg-red-50' : 'text-zinc-700')}>
              {item.icon && <span className="flex size-4 items-center justify-center text-zinc-500 [&>svg]:size-4">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.hint && <span className="text-[11px] text-zinc-400">{item.hint}</span>}
            </button>
          ))}
        </div>, document.body)}
    </div>
  );
}

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; title?: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-8 items-center rounded-lg bg-zinc-100 p-0.5">
      {options.map(o => (
        <button key={o.value} role="radio" aria-checked={value === o.value} title={o.title} onClick={() => onChange(o.value)}
          className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-all',
            value === o.value ? 'bg-white text-zinc-900 shadow-soft' : 'text-zinc-500 hover:text-zinc-800')}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- Toasts ---------- */
type Toast = { id: number; tone: 'success' | 'error' | 'info'; title: string; description?: string; action?: { label: string; onClick: () => void } };
type ToastFn = (title: string, opts?: { tone?: Toast['tone']; description?: string; action?: Toast['action'] }) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const toast = useCallback<ToastFn>((title, opts = {}) => {
    const id = nextId.current++;
    setToasts(t => [...t.slice(-3), { id, title, tone: opts.tone || 'success', description: opts.description, action: opts.action }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), opts.tone === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {createPortal(
        <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
          {toasts.map(t => (
            <div key={t.id} role="status" className="pointer-events-auto flex animate-toast items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-pop">
              {t.tone === 'success' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : t.tone === 'error' ? <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" /> : <Info className="mt-0.5 size-4 shrink-0 text-indigo-600" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[13px] text-zinc-500">{t.description}</p>}
              </div>
              {t.action && <Button size="sm" variant="ghost" onClick={() => { t.action!.onClick(); setToasts(x => x.filter(y => y.id !== t.id)); }}>{t.action.label}</Button>}
              <button aria-label="Dismiss" onClick={() => setToasts(x => x.filter(y => y.id !== t.id))} className="text-zinc-400 hover:text-zinc-700"><X className="size-4" /></button>
            </div>
          ))}
        </div>, document.body)}
    </ToastCtx.Provider>
  );
}

/* ---------- Misc ---------- */
export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 [&>svg]:size-6">{icon}</div>
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function relativeTime(seconds: number): string {
  if (!seconds) return '';
  const diff = Date.now() / 1000 - seconds;
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`;
  return new Date(seconds * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Zoom the whole app (− 90% +). Click the percentage to reset to 100%. */
export function AppZoomControl({ className }: { className?: string }) {
  const [z, setZ] = useState(appZoom());
  useEffect(() => onAppZoom(setZ), []);
  return (
    <div role="group" aria-label="App zoom" className={cn('flex items-center rounded-md border border-zinc-200 bg-white', className)}>
      <button aria-label="Zoom out the app" title="Zoom out the whole app" onClick={() => stepAppZoom(-1)} className="grid h-6 w-6 place-items-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"><ZoomOut className="size-3.5" /></button>
      <button title="App zoom — click to reset to 100%" onClick={() => stepAppZoom(0)} className="h-6 min-w-9 px-0.5 text-[11px] tabular-nums text-zinc-600 hover:bg-zinc-100">{Math.round(z * 100)}%</button>
      <button aria-label="Zoom in the app" title="Zoom in the whole app" onClick={() => stepAppZoom(1)} className="grid h-6 w-6 place-items-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"><ZoomIn className="size-3.5" /></button>
    </div>
  );
}
