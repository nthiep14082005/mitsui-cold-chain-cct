'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import { TwoHorizonsBackground } from '@/components/auth/two-horizons/TwoHorizonsBackground';
import { useCct } from '@/components/layout/CctContext';
import { tx } from '@/lib/i18n';

const QUICK_CUSTOMER_ACCOUNTS = [
  { label: 'Bách Hóa Xanh', email: 'bao.pham@bachhoaxanh.com', password: 'Customer@2026' },
  { label: 'Saigon Co.op', email: 'ha.vo@saigoncoop.vn', password: 'Customer@2026' },
  { label: 'WinCommerce', email: 'hung.dang@wincommerce.vn', password: 'Customer@2026' },
];

export default function CustomerLoginPage() {
  const { loginWithMode, pushToast, reloadAuth, lang } = useCct();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Prefilled B2B Customer default account
  const [email, setEmail] = useState('bao.pham@bachhoaxanh.com');
  const [password, setPassword] = useState('Customer@2026');

  // Register state
  const [regName, setRegName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await loginWithMode({
      mode: 'CUSTOMER_LOGIN',
      email,
      password,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || tx(lang, 'Đăng nhập thất bại.', 'ログインに失敗しました。'));
      return;
    }
    window.location.assign('/customer');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          companyName: regCompany,
          email: regEmail,
          phone: regPhone,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || tx(lang, 'Đăng ký tài khoản thất bại.', 'アカウント登録に失敗しました。'));
        return;
      }
      await reloadAuth();
      pushToast(
        'success',
        tx(
          lang,
          `Chào mừng ${data.currentOrg?.name} gia nhập chuỗi lạnh Mitsui!`,
          `${data.currentOrg?.name} のご登録が完了しました！`
        )
      );
      window.location.assign('/customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TwoHorizonsBackground defaultScene="viola">
      <div className="w-full max-w-md rounded-3xl backdrop-blur-md bg-black/55 border border-white/15 shadow-2xl p-6 sm:p-8 text-white">
        <div className="flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/25 border border-violet-400/40 flex items-center justify-center text-violet-200 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-violet-300">
                Mitsui B2B Cold Chain
              </div>
              <h1 className="text-lg font-bold text-white">
                {tx(lang, 'Cổng Khách hàng B2B', 'B2B顧客ポータル')}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-semibold hover:bg-amber-500/30 transition"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Admin
            </Link>
            <Link
              href="/customer"
              className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> B2B
            </Link>
          </div>
        </div>

        <div className="flex gap-2 p-1 rounded-xl bg-white/10 border border-white/10 mb-5">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
              tab === 'login' ? 'bg-violet-500 text-white shadow-sm' : 'text-white/70 hover:text-white'
            }`}
          >
            {tx(lang, 'Đăng nhập Khách hàng', 'B2B顧客ログイン')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
              tab === 'register' ? 'bg-violet-500 text-white shadow-sm' : 'text-white/70 hover:text-white'
            }`}
          >
            {tx(lang, 'Đăng ký Khách hàng B2B', 'B2B新規会員登録')}
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-3.5">
            {/* Quick-select customer accounts */}
            <div>
              <div className="text-[11px] text-white/65 mb-1.5">
                {tx(lang, 'Chọn nhanh tài khoản B2B (đã điền sẵn):', 'B2Bデモアカウント クイック選択:')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CUSTOMER_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword(acc.password);
                      setError('');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                      email === acc.email
                        ? 'bg-violet-500 text-white border-violet-400'
                        : 'bg-white/10 text-white/80 border-white/15 hover:bg-white/20'
                    }`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                {tx(lang, 'Email doanh nghiệp', '法人メールアドレス')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-white/50 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-white/10 border border-white/20 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-400"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                {tx(lang, 'Mật khẩu', 'パスワード')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/50 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-white/10 border border-white/20 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-400"
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
              className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-bold text-sm transition shadow-lg disabled:opacity-50"
            >
              {submitting
                ? tx(lang, 'Đang đăng nhập...', 'ログイン中...')
                : tx(lang, 'Đăng nhập Cổng Khách hàng', 'B2Bポータルへログイン')}
            </button>

            <div className="pt-3 border-t border-white/10 text-[11px] text-white/65 font-mono">
              BHX: bao.pham@bachhoaxanh.com / Customer@2026
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                {tx(lang, 'Họ và tên người đại diện', 'ご担当者名')}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-white/50 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Nguyễn Minh An"
                  className="w-full rounded-xl bg-white/10 border border-white/20 pl-10 pr-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-400"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                {tx(lang, 'Tên doanh nghiệp B2B', '法人・企業名')}
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-white/50 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={regCompany}
                  onChange={(e) => setRegCompany(e.target.value)}
                  placeholder="Chuỗi Thực Phẩm Xanh"
                  className="w-full rounded-xl bg-white/10 border border-white/20 pl-10 pr-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-400"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-white/50 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="contact@company.vn"
                    className="w-full rounded-xl bg-white/10 border border-white/20 pl-9 pr-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-400"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1">
                  {tx(lang, 'Số điện thoại', '電話番号')}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-white/50 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0909xxxxxx"
                    className="w-full rounded-xl bg-white/10 border border-white/20 pl-9 pr-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-400"
                    required
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">
                {tx(lang, 'Mật khẩu (>= 6 ký tự)', 'パスワード（6文字以上）')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/50 absolute left-3.5 top-2.5" />
                <input
                  type="password"
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full rounded-xl bg-white/10 border border-white/20 pl-10 pr-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-400"
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
              className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {submitting
                ? tx(lang, 'Đang khởi tạo tài khoản...', '登録処理中...')
                : tx(lang, 'Đăng ký & Vào cổng B2B', '登録してB2Bポータルへ')}
            </button>
          </form>
        )}
      </div>
    </TwoHorizonsBackground>
  );
}
