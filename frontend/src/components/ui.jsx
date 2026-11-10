import { useEffect } from 'react';
import { Inbox, Loader2, Search, X } from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
};
const SIZES = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, ...props }) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant], SIZES[size], className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, title, variant = 'ghost', className, ...props }) {
  const colors = {
    ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
    danger: 'text-slate-500 hover:bg-red-50 hover:text-red-600',
    brand: 'text-slate-500 hover:bg-brand-50 hover:text-brand-600',
  };
  return (
    <button title={title} className={cx('rounded-lg p-2 transition', colors[variant], className)} {...props}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function Field({ label, required, hint, children, className }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Input({ label, required, hint, className, ...props }) {
  return (
    <Field label={label} required={required} hint={hint} className={className}>
      <input className="input" required={required} {...props} />
    </Field>
  );
}

export function Select({ label, required, hint, className, children, ...props }) {
  return (
    <Field label={label} required={required} hint={hint} className={className}>
      <select className="input" required={required} {...props}>{children}</select>
    </Field>
  );
}

export function Textarea({ label, required, hint, className, ...props }) {
  return (
    <Field label={label} required={required} hint={hint} className={className}>
      <textarea className="input min-h-[90px]" required={required} {...props} />
    </Field>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Tìm kiếm...', className }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input className="input !pl-10" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

const BADGE = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
};
export function Badge({ color = 'slate', children, className }) {
  return (
    <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', BADGE[color], className)}>
      {children}
    </span>
  );
}
export function StatusBadge({ map, value }) {
  const s = map[value] || { label: value, color: 'slate' };
  return <Badge color={s.color}>{s.label}</Badge>;
}

export function Card({ title, actions, children, className, bodyClass = 'p-5' }) {
  return (
    <div className={cx('card', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          {actions}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colors = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
  };
  return (
    <div className="card flex items-start gap-4 p-5">
      <div className={cx('rounded-xl p-3', colors[color])}><Icon className="h-6 w-6" /></div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold text-slate-800">{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
      <div className="fixed inset-0" onClick={onClose} />
      <div className={cx('relative my-8 w-full animate-fade-in rounded-2xl bg-white shadow-2xl', widths[size])}>
        {title && (
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className }) {
  return (
    <div className={cx('flex items-center justify-center py-16', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
    </div>
  );
}

export function EmptyState({ title = 'Không có dữ liệu', message, icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-4"><Icon className="h-7 w-7 text-slate-400" /></div>
      <p className="font-medium text-slate-700">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <span>{error}</span>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}

export function InfoRow({ label, children }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{children ?? '—'}</span>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition',
            value === t.value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-800',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export { cx };
