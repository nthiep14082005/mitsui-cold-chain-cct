'use client';

import React from 'react';
import clsx from 'clsx';
import { useCct } from '@/components/layout/CctContext';

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

export const LOT_STATUS_META: Record<string, { label: string; ja: string; tone: BadgeTone }> = {
  DA_TAO: { label: 'Đã tạo', ja: '作成済', tone: 'slate' },
  DANG_LAM_LANH: { label: 'Đang làm lạnh', ja: '予冷中', tone: 'blue' },
  DANG_TRUNG_CHUYEN: { label: 'Đang trung chuyển', ja: '中継輸送中', tone: 'purple' },
  TRONG_KHO: { label: 'Trong kho', ja: '倉庫保管中', tone: 'blue' },
  DANG_GIAO: { label: 'Đang giao', ja: '配送中', tone: 'amber' },
  DA_GIAO: { label: 'Đã giao', ja: '納品完了', tone: 'emerald' },
  CO_KHIEU_NAI: { label: 'Có khiếu nại', ja: 'クレーム中', tone: 'rose' },
  DONG: { label: 'Đóng', ja: 'クローズ', tone: 'slate' },
};

export const ORDER_STATUS_META: Record<string, { label: string; ja: string; tone: BadgeTone }> = {
  DA_NHAN: { label: 'Đã nhận', ja: '受付済', tone: 'blue' },
  PHAT_SINH: { label: 'Phát sinh (>14:00)', ja: '締切後追加 (>14:00)', tone: 'amber' },
  DA_XAC_NHAN: { label: 'Đã xác nhận', ja: '確定済', tone: 'emerald' },
  TU_CHOI: { label: 'Từ chối', ja: '却下', tone: 'rose' },
  DANG_THUC_HIEN: { label: 'Đang thực hiện', ja: '手配中', tone: 'purple' },
  HOAN_TAT: { label: 'Hoàn tất', ja: '完了', tone: 'emerald' },
};

export function LotStatusBadge({ status }: { status: string }) {
  const { lang } = useCct();
  const m = LOT_STATUS_META[status] ?? { label: status, ja: status, tone: 'slate' as BadgeTone };
  return <Badge tone={m.tone}>{lang === 'ja' ? m.ja : m.label}</Badge>;
}

export function OrderStatusBadge({ status }: { status: string }) {
  const { lang } = useCct();
  const m = ORDER_STATUS_META[status] ?? { label: status, ja: status, tone: 'slate' as BadgeTone };
  return <Badge tone={m.tone}>{lang === 'ja' ? m.ja : m.label}</Badge>;
}
