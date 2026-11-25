import React from 'react';
import clsx from 'clsx';

export function Card({
  children,
  className,
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        'bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden',
        className
      )}
    >
      {(title || action) && (
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            {title && (
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">{title}</h3>
            )}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'default' | 'emerald' | 'blue' | 'amber' | 'rose';
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/40'
      : tone === 'blue'
        ? 'border-blue-200 bg-blue-50/40'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50/50'
          : tone === 'rose'
            ? 'border-rose-200 bg-rose-50/50'
            : 'border-slate-200 bg-white';
  return (
    <div className={clsx('rounded-2xl border p-4 shadow-sm', toneClass)}>
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
        <span>{label}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-600">{sub}</div>}
    </div>
  );
}
