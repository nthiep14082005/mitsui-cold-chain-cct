'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { useCct } from './CctContext';

/**
 * Single 2-way toggle switching seamlessly between Vietnamese (VI) and Japanese (JA).
 */
export function LangToggle({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { lang, toggleLang } = useCct();

  if (variant === 'dark') {
    return (
      <button
        type="button"
        onClick={toggleLang}
        title={lang === 'vi' ? 'Chuyển sang Tiếng Nhật (JA)' : 'ベトナム語 (VI) に切替'}
        className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 hover:bg-black/75 border border-white/25 backdrop-blur-sm text-xs font-semibold text-white transition"
      >
        <Globe className="w-3.5 h-3.5 text-white/75" />
        <span className={lang === 'vi' ? 'text-amber-300 font-bold' : 'text-white/60'}>VI</span>
        <span className="text-white/40">⇄</span>
        <span className={lang === 'ja' ? 'text-violet-300 font-bold' : 'text-white/60'}>日本語</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLang}
      title={lang === 'vi' ? 'Chuyển sang Tiếng Nhật (JA)' : 'ベトナム語 (VI) に切替'}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition whitespace-nowrap"
    >
      <Globe className="w-3.5 h-3.5 text-emerald-600" />
      <span className={lang === 'vi' ? 'text-emerald-700 font-bold' : 'text-slate-400'}>VI</span>
      <span className="text-slate-300">⇄</span>
      <span className={lang === 'ja' ? 'text-emerald-700 font-bold' : 'text-slate-400'}>日本語</span>
    </button>
  );
}
