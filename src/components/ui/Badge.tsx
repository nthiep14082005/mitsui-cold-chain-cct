'use client';

import React from 'react';
import clsx from 'clsx';
import { useCct } from '@/components/layout/CctContext';
import {
  ALLOC_CONFIRM_I18N,
  CLAIM_STATUS_I18N,
  LOT_STATUS_I18N,
  LocalizedBadgeMeta,
  ORDER_STATUS_I18N,
  ORG_TYPE_I18N,
  STATEMENT_STATUS_I18N,
  TRIP_STATUS_I18N,
  TRIP_TYPE_I18N,
} from '@/lib/i18n';

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

function MappedBadge({
  map,
  value,
}: {
  map: Record<string, LocalizedBadgeMeta>;
  value: string;
}) {
  const { lang } = useCct();
  const m = map[value] ?? { vi: value, ja: value, tone: 'slate' as BadgeTone };
  return <Badge tone={m.tone}>{lang === 'ja' ? m.ja : m.vi}</Badge>;
}

export function LotStatusBadge({ status }: { status: string }) {
  return <MappedBadge map={LOT_STATUS_I18N} value={status} />;
}

export function OrderStatusBadge({ status }: { status: string }) {
  return <MappedBadge map={ORDER_STATUS_I18N} value={status} />;
}

export function TripTypeBadge({ tripType }: { tripType: string }) {
  return <MappedBadge map={TRIP_TYPE_I18N} value={tripType} />;
}

export function TripStatusBadge({ status }: { status: string }) {
  return <MappedBadge map={TRIP_STATUS_I18N} value={status} />;
}

export function ClaimStatusBadge({ status }: { status: string }) {
  return <MappedBadge map={CLAIM_STATUS_I18N} value={status} />;
}

export function StatementStatusBadge({ status }: { status: string }) {
  return <MappedBadge map={STATEMENT_STATUS_I18N} value={status} />;
}

export function OrgTypeBadge({ orgType }: { orgType: string }) {
  return <MappedBadge map={ORG_TYPE_I18N} value={orgType} />;
}

export function AllocConfirmBadge({ status }: { status: string }) {
  return <MappedBadge map={ALLOC_CONFIRM_I18N} value={status} />;
}
