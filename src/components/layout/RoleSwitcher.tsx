'use client';

import React from 'react';
import { UserCheck } from 'lucide-react';
import { ROLE_LABELS_I18N } from '@/lib/i18n';
import { useCct } from './CctContext';

export function RoleSwitcher({ compact = false }: { compact?: boolean }) {
  const { channel, currentUser, demoUsers, switchUser, lang } = useCct();

  const scopedUsers = demoUsers.filter((u) => {
    if (channel === 'customer') return u.role === 'KHACH_HANG';
    if (channel === 'field') {
      return ['NHA_CUNG_CAP', 'NHAN_VIEN_SO_CHE', 'NHAN_VIEN_KHO', 'TAI_XE'].includes(u.role);
    }
    return ['DIEU_PHOI_VIEN', 'QUAN_LY_QC', 'QUAN_TRI_HE_THONG'].includes(u.role);
  });

  if (!scopedUsers.length) return null;

  return (
    <div className="flex items-center gap-1.5">
      {!compact && <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 hidden sm:block" />}
      <select
        aria-label={channel === 'customer' ? 'B2B Account' : 'Role Switcher'}
        value={currentUser?.id ?? ''}
        onChange={(e) => {
          if (e.target.value) switchUser(e.target.value);
        }}
        className="text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[165px] sm:max-w-[250px]"
      >
        {scopedUsers.map((u) => {
          const roleText = ROLE_LABELS_I18N[u.role]?.[lang] ?? u.role;
          return (
            <option key={u.id} value={u.id}>
              {channel === 'customer' ? u.orgName : `${roleText} — ${u.name}`}
            </option>
          );
        })}
      </select>
    </div>
  );
}
