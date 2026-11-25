'use client';

import React from 'react';
import { Inbox } from 'lucide-react';
import { useCct } from '@/components/layout/CctContext';
import { tx } from '@/lib/i18n';

export function EmptyState({
  title,
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { lang } = useCct();
  const resolvedTitle = title ?? tx(lang, 'Chưa có dữ liệu', 'データがありません');
  const resolvedDescription =
    description ??
    tx(
      lang,
      'Không tìm thấy bản ghi phù hợp với bộ lọc hiện tại.',
      '現在の条件に一致するレコードが見つかりません。'
    );

  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
      <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <Inbox className="w-5 h-5" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{resolvedTitle}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{resolvedDescription}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
