'use client';

import React from 'react';
import { UserCheck } from 'lucide-react';
import { useCct } from './CctContext';
import { UserRole } from '@/types/common';

const ROLE_LABELS: Record<UserRole, string> = {
  DIEU_PHOI_VIEN: 'Điều phối viên (Mitsui)',
  QUAN_LY_QC: 'Quản lý / QC (Mitsui)',
  QUAN_TRI_HE_THONG: 'Quản trị hệ thống (Mitsui)',
  KHACH_HANG: 'Khách hàng B2B',
  NHA_CUNG_CAP: 'Nhà cung cấp (HTX)',
  NHAN_VIEN_SO_CHE: 'Nhân viên sơ chế',
  NHAN_VIEN_KHO: 'Nhân viên kho lạnh',
  TAI_XE: 'Tài xế / Vận tải',
  NGUOI_TIEU_DUNG: 'Người tiêu dùng (QR)',
};

export function RoleSwitcher({ compact = false }: { compact?: boolean }) {
  const { channel, currentUser, demoUsers, switchUser } = useCct();

  // Strictly scope visible accounts to the active channel (never expose Admin/Mitsui on customer!)
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
        aria-label={channel === 'customer' ? 'Chọn tài khoản Khách hàng B2B' : 'Chuyển vai trò'}
        value={currentUser?.id ?? ''}
        onChange={(e) => {
          if (e.target.value) switchUser(e.target.value);
        }}
        className="text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[175px] sm:max-w-[260px]"
      >
        {scopedUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {channel === 'customer' ? u.orgName : `${ROLE_LABELS[u.role]} — ${u.name}`}
          </option>
        ))}
      </select>
    </div>
  );
}
