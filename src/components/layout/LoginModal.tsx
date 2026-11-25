'use client';

import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useCct } from './CctContext';

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { loginWithMode } = useCct();
  const [tab, setTab] = useState<'OTP' | 'CUSTOMER_LOGIN'>('CUSTOMER_LOGIN');
  const [email, setEmail] = useState('bao.pham@bachhoaxanh.com');
  const [password, setPassword] = useState('Customer@2026');
  const [phone, setPhone] = useState('0914000001');
  const [otp, setOtp] = useState('123456');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await loginWithMode({
      mode: tab,
      email: tab === 'CUSTOMER_LOGIN' ? email : undefined,
      password: tab === 'CUSTOMER_LOGIN' ? password : undefined,
      phone: tab === 'OTP' ? phone : undefined,
      otp: tab === 'OTP' ? otp : undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Đăng nhập thất bại.');
      return;
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Đăng nhập bảo mật (NFR-08)" maxWidth="max-w-md">
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-4">
        <button
          type="button"
          onClick={() => setTab('CUSTOMER_LOGIN')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
            tab === 'CUSTOMER_LOGIN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Khách hàng B2B
        </button>
        <button
          type="button"
          onClick={() => setTab('OTP')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
            tab === 'OTP' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          <Smartphone className="w-4 h-4" /> App (SĐT + OTP)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {tab === 'CUSTOMER_LOGIN' ? (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Email đăng nhập
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Số điện thoại hiện trường (Zalo/SMS)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="VD: 0914000001"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Mã xác thực OTP / 2FA (mô phỏng: nhập 4–6 số bất kỳ, VD: 123456)
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm font-mono"
              required
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? 'Đang xác thực...' : 'Xác nhận đăng nhập'}
        </button>
      </form>
    </Modal>
  );
}
