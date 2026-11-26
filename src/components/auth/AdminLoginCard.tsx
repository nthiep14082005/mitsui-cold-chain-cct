'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { FreshProduceBackground } from '@/components/auth/FreshProduceBackground';
import { useCct } from '@/components/layout/CctContext';
import { tx } from '@/lib/i18n';

const QUICK_MITSUI_ACCOUNTS = [
  {
    labelVi: 'Admin 02',
    labelJa: 'Admin 02',
    email: 'admin2@mitsui-cct.vn',
    password: 'Admin@2026',
    otp: '123456',
  },
  {
    labelVi: 'Điều phối viên',
    labelJa: '配車・調整担当',
    email: 'tuan.nguyen@mitsui-cct.vn',
    password: 'Mitsui@2026',
    otp: '123456',
  },
  {
    labelVi: 'Quản lý QC',
    labelJa: 'QCマネージャー',
    email: 'lananh.tran@mitsui-cct.vn',
    password: 'Mitsui@2026',
    otp: '123456',
  },
  {
    labelVi: 'Admin 01',
    labelJa: 'Admin 01',
    email: 'nam.le@mitsui-cct.vn',
    password: 'Admin@2026',
    otp: '123456',
  },
];

export function AdminLoginCard({ nextUrl }: { nextUrl: string }) {
  const { loginWithMode, lang } = useCct();
  const [email, setEmail] = useState('admin2@mitsui-cct.vn');
  const [password, setPassword] = useState('Admin@2026');
  const [otp, setOtp] = useState('123456');
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
      setError(res.error || tx(lang, 'Đăng nhập quản trị thất bại.', '管理者ログインに失敗しました。'));
      return;
    }
    const safeNext = nextUrl.startsWith('/control-tower') ? nextUrl : '/control-tower/admin';
    window.location.assign(safeNext);
  };

  return (
    <FreshProduceBackground variant="admin">
      <div className="w-full max-w-md rounded-3xl backdrop-blur-md bg-white/85 dark:bg-emerald-950/75 border border-emerald-200/80 dark:border-emerald-700/50 shadow-2xl shadow-emerald-950/15 p-6 sm:p-8 text-slate-900 dark:text-white">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-300/80 dark:bg-emerald-800/60 dark:border-emerald-600/50 flex items-center justify-center text-emerald-700 dark:text-emerald-200 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                Mitsui Internal Portal
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {tx(lang, 'Đăng nhập Quản trị & Điều phối', '管理者・Control Tower ログイン')}
              </h1>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-emerald-800 dark:text-emerald-200/80 dark:hover:text-white transition whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {tx(lang, 'Khách hàng', '顧客ポータル')}
          </Link>
        </div>

        {/* Quick-select Mitsui accounts */}
        <div className="mb-4">
          <div className="text-[11px] font-medium text-slate-600 dark:text-emerald-100/75 mb-1.5">
            {tx(lang, 'Chọn nhanh tài khoản nội bộ (đã điền sẵn):', '社内アカウント クイック選択:')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_MITSUI_ACCOUNTS.map((acc) => {
              const active = email === acc.email;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                    setOtp(acc.otp);
                    setError('');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                    active
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                      : 'bg-emerald-50/90 text-emerald-900 border-emerald-200 hover:bg-emerald-100 dark:bg-white/10 dark:text-white/85 dark:border-white/15 dark:hover:bg-white/20'
                  }`}
                >
                  {lang === 'ja' ? acc.labelJa : acc.labelVi}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-100/85 mb-1">
              {tx(lang, 'Email nội bộ Mitsui', 'Mitsui 社内メールアドレス')}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-emerald-600/70 dark:text-emerald-300/70 absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-white/90 dark:bg-emerald-950/60 border border-emerald-300/80 dark:border-emerald-700/60 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-100/85 mb-1">
              {tx(lang, 'Mật khẩu', 'パスワード')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-emerald-600/70 dark:text-emerald-300/70 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-white/90 dark:bg-emerald-950/60 border border-emerald-300/80 dark:border-emerald-700/60 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-100/85 mb-1">
              {tx(lang, 'Mã OTP xác thực 2 lớp (2FA — NFR-08)', '2段階認証 OTP コード (2FA — NFR-08)')}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-emerald-600/70 dark:text-emerald-300/70 absolute left-3.5 top-3" />
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full rounded-xl bg-white/90 dark:bg-emerald-950/60 border border-emerald-300/80 dark:border-emerald-700/60 pl-10 pr-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-300 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:bg-rose-500/20 dark:border-rose-400/40 dark:text-rose-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm transition shadow-lg shadow-emerald-900/20 disabled:opacity-50"
          >
            {submitting
              ? tx(lang, 'Đang xác thực phiên 7 ngày...', '7日間セッション認証中...')
              : tx(lang, 'Đăng nhập Control Tower', 'Control Tower にログイン')}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-emerald-200/70 dark:border-emerald-700/40 text-[11px] text-slate-600 dark:text-emerald-100/70 space-y-1">
          <div>
            {tx(
              lang,
              'Phiên đăng nhập bảo mật HttpOnly được duy trì tự động trong 7 ngày.',
              'HttpOnly 署名付きセッションは 7 日間自動保持されます。'
            )}
          </div>
          <div className="font-mono font-medium text-emerald-800 dark:text-emerald-200/90">
            admin2@mitsui-cct.vn / Admin@2026 / OTP: 123456
          </div>
        </div>
      </div>
    </FreshProduceBackground>
  );
}
