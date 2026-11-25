import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Snowflake,
  Truck,
} from 'lucide-react';
import { readDb } from '@/lib/db';
import { buildPublicQrPayload } from '@/domain/kpi-scoring';

export const dynamic = 'force-dynamic';

/**
 * Channel 4: Public Consumer QR Traceability Page (FR-48, FR-49, FR-50, BR-15).
 * No login required. Strictly renders ONLY sanitized public fields.
 */
export default async function PublicQrTracePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await readDb();
  const lot = db.lots.find((l) => l.qrToken === token);
  if (!lot) {
    notFound();
  }

  const info = buildPublicQrPayload(lot, db);

  const verdictStyle =
    info.coldChainVerdict === 'DAT_CHUOI_LANH'
      ? {
          bg: 'bg-emerald-600',
          box: 'bg-emerald-50 border-emerald-200 text-emerald-900',
          icon: <ShieldCheck className="w-7 h-7 text-white" />,
        }
      : info.coldChainVerdict === 'DANG_VAN_CHUYEN'
        ? {
            bg: 'bg-blue-600',
            box: 'bg-blue-50 border-blue-200 text-blue-900',
            icon: <Truck className="w-7 h-7 text-white" />,
          }
        : {
            bg: 'bg-rose-600',
            box: 'bg-rose-50 border-rose-200 text-rose-900',
            icon: <AlertTriangle className="w-7 h-7 text-white" />,
          };

  return (
    <div className="min-h-screen bg-slate-100 py-5 px-3 sm:px-4">
      <main className="max-w-md mx-auto bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Snowflake className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold tracking-wide uppercase">
              Truy xuất nguồn gốc chuỗi lạnh
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-300">{info.lotCode}</span>
        </div>

        {/* Verdict Banner (FR-48, FR-50, BR-15) */}
        <div className={`${verdictStyle.bg} text-white px-5 py-5 flex items-center gap-3.5`}>
          <div className="p-2.5 rounded-2xl bg-white/15 shrink-0">{verdictStyle.icon}</div>
          <div>
            <div className="text-[11px] uppercase tracking-wider opacity-85 font-semibold">
              Kết quả giám sát chuỗi lạnh
            </div>
            <div className="text-xl font-bold leading-snug">{info.verdictLabel}</div>
          </div>
        </div>

        {/* Product & Origin Info */}
        <div className="p-5 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{info.productName}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{info.packagingSpec}</p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 text-sm bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400">Vùng trồng</div>
                <div className="font-semibold text-slate-800">{info.growingArea}</div>
              </div>
            </div>

            {info.htxName && (
              <div className="flex items-start gap-2.5">
                <Award className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">Nhà cung cấp / HTX</div>
                  <div className="font-semibold text-slate-800">{info.htxName}</div>
                </div>
              </div>
            )}

            {info.certCode && (
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">Chứng nhận</div>
                  <div className="font-semibold text-slate-800">{info.certCode}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">Ngày thu hoạch</div>
                  <div className="text-xs font-bold text-slate-800">{info.harvestDate}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">Ngày sơ chế</div>
                  <div className="text-xs font-bold text-slate-800">{info.packingDate}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Journey Milestones (FR-48, FR-49: no warehouse/carrier/plate/temp details) */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Các mốc hành trình chuỗi lạnh
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
                      {m.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {m.completedAt
                        ? new Date(m.completedAt).toLocaleString('vi-VN', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                          })
                        : 'Đang chờ cập nhật'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 text-center">
            <Link href="/" className="text-xs font-medium text-slate-400 hover:text-slate-600">
              Hệ thống điều phối Mitsui Cold Chain Control Tower
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
