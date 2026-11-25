import React from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({
  title = 'Chưa có dữ liệu',
  description = 'Không tìm thấy bản ghi phù hợp với bộ lọc hiện tại.',
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
      <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <Inbox className="w-5 h-5" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
