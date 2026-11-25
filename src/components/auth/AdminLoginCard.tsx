'use client';

import React, { useState } from 'react';
import { KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { TwoHorizonsBackground } from '@/components/auth/two-horizons/TwoHorizonsBackground';
import { useCct } from '@/components/layout/CctContext';

export function AdminLoginCard({ nextUrl }: { nextUrl: string }) {
  const { loginWithMode } = useCct();
  const [email, setEmail] = useState('admin2@mitsui-cct.vn');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await loginWithMode({
      mode: 'ADMIN_LOGIN',
      email,
      password,
      otp,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Đăng nhập quản trị thất bại.');
      return;
    }
    const safeNext = nextUrl.startsWith('/control-tower') ? nextUrl : '/control-tower/admin';
    window.location.assign(safeNext);
  };

  return (
    <TwoHorizonsBackground defaultScene="aurum">
      <div className="w-full max-w-md rounded-3xl backdrop-blur-md bg-black/55 border border-white/15 shadow-2xl p-6 sm:p-8 text-white">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-amber-300">
              Mitsui Internal Portal
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white">
              Đăng nhập Quản trị & Điều phối
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/80 mb-1.5">
              Email nội bộ Mitsui
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-white/50 absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin2@mitsui-cct.vn"
                className="w-full rounded-xl bg-white/10 border border-white/20 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/80 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-white/50 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full rounded-xl bg-white/10 border border-white/20 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/80 mb-1.5">
              Mã OTP xác thực 2 lớp (2FA — NFR-08)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-white/50 absolute left-3.5 top-3" />
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Nhập mã OTP 6 số..."
                className="w-full rounded-xl bg-white/10 border border-white/20 pl-10 pr-3.5 py-2.5 text-sm font-mono text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/20 border border-rose-400/40 px-3.5 py-2.5 text-xs text-rose-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg disabled:opacity-50"
          >
            {submitting ? 'Đang xác thực phiên 7 ngày...' : 'Xác nhận đăng nhập Control Tower'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-white/65 space-y-1">
          <div>Phiên đăng nhập bảo mật HttpOnly được duy trì tự động trong 7 ngày.</div>
          <div className="font-mono text-amber-200/80">
            Demo: admin2@mitsui-cct.vn / Admin@2026 / OTP: 123456
          </div>
        </div>
      </div>
    </TwoHorizonsBackground>
  );
}
