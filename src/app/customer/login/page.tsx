'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, Lock, Mail, Phone, User, UserPlus } from 'lucide-react';
import { TwoHorizonsBackground } from '@/components/auth/two-horizons/TwoHorizonsBackground';
import { useCct } from '@/components/layout/CctContext';

export default function CustomerLoginPage() {
  const { loginWithMode, pushToast, reloadAuth } = useCct();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Login state
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
      setError(res.error || 'Đăng nhập thất bại.');
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
        setError(data.error || 'Đăng ký tài khoản thất bại.');
        return;
      }
      await reloadAuth();
      pushToast('success', `Chào mừng ${data.currentOrg?.name} gia nhập chuỗi lạnh Mitsui!`);
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
              <h1 className="text-lg font-bold text-white">Cổng Khách hàng B2B</h1>
            </div>
          </div>
          <Link
            href="/customer"
            className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Cổng B2B
          </Link>
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
            Đăng nhập Khách hàng
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
            Đăng ký Khách hàng B2B
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1.5">Email doanh nghiệp</label>
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
              <label className="block text-xs font-medium text-white/80 mb-1.5">Mật khẩu</label>
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
              {submitting ? 'Đang đăng nhập...' : 'Đăng nhập Cổng Khách hàng'}
            </button>

            <div className="pt-3 border-t border-white/10 text-[11px] text-white/65 font-mono">
              Demo BHX: bao.pham@bachhoaxanh.com / Customer@2026
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">Họ và tên người đại diện</label>
              <div className="relative">
                <User className="w-4 h-4 text-white/50 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="VD: Nguyễn Minh An"
                  className="w-full rounded-xl bg-white/10 border border-white/20 pl-10 pr-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-violet-400"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/80 mb-1">Tên doanh nghiệp B2B</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-white/50 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={regCompany}
                  onChange={(e) => setRegCompany(e.target.value)}
                  placeholder="VD: Chuỗi Thực Phẩm Xanh"
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
                <label className="block text-xs font-medium text-white/80 mb-1">Số điện thoại</label>
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
              <label className="block text-xs font-medium text-white/80 mb-1">Mật khẩu (&gt;= 6 ký tự)</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/50 absolute left-3.5 top-2.5" />
                <input
                  type="password"
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
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
              {submitting ? 'Đang khởi tạo tài khoản & hợp đồng...' : 'Đăng ký & Vào cổng B2B'}
            </button>
          </form>
        )}
      </div>
    </TwoHorizonsBackground>
  );
}
