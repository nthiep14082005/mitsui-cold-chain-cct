'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Snowflake,
  Truck,
} from 'lucide-react';
import { PublicQrPayload } from '@/domain/kpi-scoring';
import { useCct } from '@/components/layout/CctContext';
import { LangToggle } from '@/components/layout/LangToggle';
import {
  displayOrgName,
  displayPackagingSpec,
  displayPlace,
  displayProductName,
  formatDateTime,
  t,
  tx,
} from '@/lib/i18n';

const MILESTONE_JA: Record<string, string> = {
  BG1: 'メコンデルタでの受入・選果工程',
  BG2: '予冷完了・中継トラック積込',
  BG3: '中継冷蔵倉庫への入庫',
  BG4: '配送向け冷蔵倉庫からの出庫',
  BG5: 'ホーチミン販売拠点への納品完了',
};

export function PublicQrClientView({ info }: { info: PublicQrPayload }) {
  const router = useRouter();
  const { lang } = useCct();

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      const hasHistory = window.history.length > 1;
      const sameOriginReferrer =
        Boolean(document.referrer) && document.referrer.startsWith(window.location.origin);
      if (hasHistory && sameOriginReferrer) {
        router.back();
        return;
      }
      if (hasHistory && !document.referrer) {
        // Fallback when referrer header stripped within same tab session
        router.back();
        return;
      }
    }
    router.push('/');
  };

  const verdictLabel =
    info.coldChainVerdict === 'DAT_CHUOI_LANH'
      ? tx(lang, 'Đạt chuỗi lạnh', 'コールドチェーン基準適合')
      : info.coldChainVerdict === 'DANG_VAN_CHUYEN'
        ? tx(lang, 'Đang vận chuyển', '配送中（輸送継続）')
        : tx(lang, 'Không đạt chuỗi lạnh', 'コールドチェーン基準不適合');

  const verdictStyle =
    info.coldChainVerdict === 'DAT_CHUOI_LANH'
      ? {
          bg: 'bg-emerald-600',
          icon: <ShieldCheck className="w-7 h-7 text-white" />,
        }
      : info.coldChainVerdict === 'DANG_VAN_CHUYEN'
        ? {
            bg: 'bg-blue-600',
            icon: <Truck className="w-7 h-7 text-white" />,
          }
        : {
            bg: 'bg-rose-600',
            icon: <AlertTriangle className="w-7 h-7 text-white" />,
          };

  return (
    <div className="min-h-screen bg-slate-100 py-5 px-3 sm:px-4">
      <main className="max-w-md mx-auto bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
        {/* Top Navigation Bar with Back Button + VI/JA Toggle */}
        <div className="px-4 py-3 bg-slate-950 text-white flex items-center justify-between gap-2 border-b border-white/10">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back', lang)}</span>
          </button>

          <LangToggle variant="dark" />
        </div>

        {/* Brand Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Snowflake className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold tracking-wide uppercase">
              {tx(lang, 'Truy xuất nguồn gốc chuỗi lạnh', 'コールドチェーン公開トレーサビリティ')}
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-300">{info.lotCode}</span>
        </div>

        {/* Verdict Banner (FR-48, FR-50, BR-15) */}
        <div className={`${verdictStyle.bg} text-white px-5 py-5 flex items-center gap-3.5`}>
          <div className="p-2.5 rounded-2xl bg-white/15 shrink-0">{verdictStyle.icon}</div>
          <div>
            <div className="text-[11px] uppercase tracking-wider opacity-85 font-semibold">
              {tx(lang, 'Kết quả giám sát chuỗi lạnh', 'コールドチェーン品質判定')}
            </div>
            <div className="text-xl font-bold leading-snug">{verdictLabel}</div>
          </div>
        </div>

        {/* Product & Origin Info */}
        <div className="p-5 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {displayProductName(info.productName, lang)}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {displayPackagingSpec(info.packagingSpec, lang)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 text-sm bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400">
                  {tx(lang, 'Vùng trồng', '生産地')}
                </div>
                <div className="font-semibold text-slate-800">
                  {displayPlace(info.growingArea, lang)}
                </div>
              </div>
            </div>

            {info.htxName && (
              <div className="flex items-start gap-2.5">
                <Award className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">
                    {tx(lang, 'Nhà cung cấp / HTX', 'サプライヤー / 農協(HTX)')}
                  </div>
                  <div className="font-semibold text-slate-800">
                    {displayOrgName(info.htxName, lang)}
                  </div>
                </div>
              </div>
            )}

            {info.certCode && (
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">
                    {tx(lang, 'Chứng nhận', '認証コード')}
                  </div>
                  <div className="font-semibold text-slate-800">{info.certCode}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">
                    {tx(lang, 'Ngày thu hoạch', '収穫日')}
                  </div>
                  <div className="text-xs font-bold text-slate-800">{info.harvestDate}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">
                    {tx(lang, 'Ngày sơ chế', '選果・梱包日')}
                  </div>
                  <div className="text-xs font-bold text-slate-800">{info.packingDate}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Journey Milestones (FR-48, FR-49) */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              {tx(lang, 'Các mốc hành trình chuỗi lạnh', 'コールドチェーン履歴')}
            </h2>
            <div className="space-y-3">
              {info.milestones.map((m) => (
                <div key={m.stage} className="flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      m.completed
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 pb-2 border-b border-slate-100">
                    <div
                      className={`text-xs font-semibold ${
                        m.completed ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {lang === 'ja' ? MILESTONE_JA[m.stage] ?? m.label : m.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {m.completedAt
                        ? formatDateTime(m.completedAt, lang)
                        : tx(lang, 'Đang chờ cập nhật', '更新待ち')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 text-center">
            <Link href="/" className="text-xs font-medium text-slate-400 hover:text-slate-600">
              Mitsui Cold Chain Control Tower
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
