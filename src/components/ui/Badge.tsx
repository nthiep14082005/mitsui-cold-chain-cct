import React from 'react';
import clsx from 'clsx';

export type BadgeTone = 'slate' | 'emerald' | 'blue' | 'amber' | 'rose' | 'purple';

const TONE_MAP: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
};

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_MAP[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export const LOT_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  DA_TAO: { label: 'Đã tạo', tone: 'slate' },
  DANG_LAM_LANH: { label: 'Đang làm lạnh', tone: 'blue' },
  DANG_TRUNG_CHUYEN: { label: 'Đang trung chuyển', tone: 'purple' },
  TRONG_KHO: { label: 'Trong kho', tone: 'blue' },
  DANG_GIAO: { label: 'Đang giao', tone: 'amber' },
  DA_GIAO: { label: 'Đã giao', tone: 'emerald' },
  CO_KHIEU_NAI: { label: 'Có khiếu nại', tone: 'rose' },
  DONG: { label: 'Đóng', tone: 'slate' },
};

export const ORDER_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  DA_NHAN: { label: 'Đã nhận', tone: 'blue' },
  PHAT_SINH: { label: 'Phát sinh (>14:00)', tone: 'amber' },
  DA_XAC_NHAN: { label: 'Đã xác nhận', tone: 'emerald' },
  TU_CHOI: { label: 'Từ chối', tone: 'rose' },
  DANG_THUC_HIEN: { label: 'Đang thực hiện', tone: 'purple' },
  HOAN_TAT: { label: 'Hoàn tất', tone: 'emerald' },
};

export function LotStatusBadge({ status }: { status: string }) {
  const m = LOT_STATUS_META[status] ?? { label: status, tone: 'slate' as BadgeTone };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function OrderStatusBadge({ status }: { status: string }) {
  const m = ORDER_STATUS_META[status] ?? { label: status, tone: 'slate' as BadgeTone };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
