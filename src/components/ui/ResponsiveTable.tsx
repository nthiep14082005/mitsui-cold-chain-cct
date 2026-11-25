'use client';

import React from 'react';
import { EmptyState } from './EmptyState';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  mobileHide?: boolean;
  align?: 'left' | 'right' | 'center';
}

/**
 * Renders a crisp desktop table and automatically switches to stacked touch-friendly cards on mobile (<768px).
 */
export function ResponsiveTable<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  emptyTitle,
  emptyDescription,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!data.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3.5 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={
                  onRowClick
                    ? 'hover:bg-emerald-50/40 cursor-pointer transition-colors'
                    : 'hover:bg-slate-50/60'
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3.5 py-3 text-slate-700 align-middle ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                    }`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {data.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2 ${
              onRowClick ? 'active:bg-slate-50 cursor-pointer' : ''
            }`}
          >
            {columns
              .filter((c) => !c.mobileHide)
              .map((col) => (
                <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 shrink-0">{col.header}</span>
                  <div className="text-right text-slate-800 font-medium">{col.render(row)}</div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}
