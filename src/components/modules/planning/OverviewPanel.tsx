'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Package,
  Snowflake,
  Truck,
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge, LotStatusBadge, TripStatusBadge } from '@/components/ui/Badge';
import { useCct } from '@/components/layout/CctContext';
import { displayPlace, formatNum, tx } from '@/lib/i18n';
import { DailyOrder } from '@/types/order-plan';
import { Lot } from '@/types/lot-epod';
import { TempAlert, Trip } from '@/types/transport-temp';

const SIX_STEPS = [
  {
    step: 'B1',
    titleVi: 'Tiếp nhận đơn & Kế hoạch',
    titleJa: '日次受注・供給計画',
    detailVi: 'Chốt trước 14:00 D-1',
    detailJa: 'D-1 14:00 締切',
  },
  {
    step: 'B2',
    titleVi: 'Kết nối HTX & Thu gom',
    titleJa: '農協連携・集荷',
    detailVi: 'Xác nhận sản lượng + VietGAP',
    detailJa: '出荷量確定 + VietGAP',
  },
  {
    step: 'B3',
    titleVi: 'Sơ chế & Làm lạnh (BG1)',
    titleJa: '選果・予冷 (BG1)',
    detailVi: 'Phân loại, dán QR, phòng mát',
    detailJa: '選別・QR貼付・予冷室',
  },
  {
    step: 'B4',
    titleVi: 'Kho lạnh Bến Lức (BG2–3)',
    titleJa: 'ベンルック冷蔵倉庫 (BG2–3)',
    detailVi: 'Buồng theo nhóm nhiệt, FEFO',
    detailJa: '温度帯別保管・FEFO出庫',
  },
  {
    step: 'B5',
    titleVi: 'Vận tải lạnh (BG4)',
    titleJa: '冷蔵配送 (BG4)',
    detailVi: 'Khóa ghép khoang BR-05, GPS',
    detailJa: '混載ロック BR-05・GPS',
  },
  {
    step: 'B6',
    titleVi: 'Giao khách & ePOD (BG5)',
    titleJa: '納品・ePOD署名 (BG5)',
    detailVi: 'Ghi đạt/loại, khiếu nại 24h',
    detailJa: '合否検品・24hクレーム窓口',
  },
];

export function OverviewPanel() {
  const { refreshTick, currentUser, lang } = useCct();
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [alerts, setAlerts] = useState<TempAlert[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const [oRes, lRes, tRes, aRes] = await Promise.all([
        fetch('/api/orders', { cache: 'no-store' }),
        fetch('/api/lots', { cache: 'no-store' }),
        fetch('/api/trips', { cache: 'no-store' }),
        fetch('/api/telemetry', { cache: 'no-store' }),
      ]);
      if (!active) return;
      if (oRes.status === 403) {
        setErrorMsg(
          tx(
            lang,
            'Tài khoản Quản trị hệ thống chỉ quản lý danh mục & tham số (mục Danh mục & Quản trị), không truy cập dữ liệu vận hành.',
            'システム管理者アカウントはマスタ・パラメータ設定（マスタ・システム管理）専用であり、運用データにはアクセスできません。'
          )
        );
        return;
      }
      setErrorMsg('');
      if (oRes.ok) setOrders((await oRes.json()).orders ?? []);
      if (lRes.ok) setLots((await lRes.json()).lots ?? []);
      if (tRes.ok) setTrips((await tRes.json()).trips ?? []);
      if (aRes.ok) setAlerts((await aRes.json()).alerts ?? []);
    }
    load();
    return () => {
      active = false;
    };
  }, [refreshTick, currentUser?.id, lang]);

  if (errorMsg) {
    return (
      <Card title={tx(lang, 'Phân quyền Quản trị hệ thống (FR-51 / NFR-07)', 'システム管理者権限分離 (FR-51 / NFR-07)')}>
        <p className="text-sm text-slate-600 mb-3">{errorMsg}</p>
        <Link
          href="/control-tower/admin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
        >
          {tx(lang, 'Đi tới Danh mục & Quản trị', 'マスタ・システム管理へ')} <ArrowRight className="w-4 h-4" />
        </Link>
      </Card>
    );
  }

  const adHocCount = orders.filter((o) => o.status === 'PHAT_SINH').length;
  const openAlerts = alerts.filter((a) => !a.acknowledgedAt).length;
  const activeLots = lots.filter((l) => l.childLotIds.length === 0);
  const dailyPilotLots = activeLots.filter((l) => !l.id.startsWith('LOT-NOV-'));
  const activeTrips = trips.filter((t) => t.status === 'DANG_CHAY');

  const todayVolumeKg = dailyPilotLots.reduce((s, l) => s + l.initialKg, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {tx(
              lang,
              'Trung tâm điều phối chuỗi lạnh (Control Tower)',
              'コールドチェーン統合管制センター (Control Tower)'
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {tx(
              lang,
              'Hành lang ĐBSCL → Cơ sở sơ chế → Kho Bến Lức → TP.HCM · Mục tiêu 17–20 tấn/ngày',
              'メコンデルタ → 選果場 → ベンルック冷蔵倉庫 → ホーチミン · 目標 17–20トン/日'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/control-tower/orders-plan"
            className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700"
          >
            {tx(lang, 'Lập kế hoạch ngày D', 'D日供給計画作成')}
          </Link>
          <Link
            href="/control-tower/lots"
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50"
          >
            {tx(lang, 'Xem hồ sơ lô', 'ロット詳細確認')}
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label={tx(lang, 'Lô đang theo dõi (thực địa)', '追跡中ロット（現場）')}
          value={dailyPilotLots.length}
          sub={tx(
            lang,
            `${(todayVolumeKg / 1000).toFixed(1)} tấn mẫu vận hành`,
            `運用サンプル ${(todayVolumeKg / 1000).toFixed(1)} トン`
          )}
          tone="emerald"
          icon={<Package className="w-4 h-4" />}
        />
        <StatCard
          label={tx(lang, 'Đơn phát sinh chờ duyệt', '締切後追加注文（承認待ち）')}
          value={adHocCount}
          sub={tx(lang, 'Gửi sau giờ chốt 14:00 D-1', 'D-1 14:00 締切後の受付分')}
          tone={adHocCount > 0 ? 'amber' : 'default'}
          icon={<ClipboardList className="w-4 h-4" />}
        />
        <StatCard
          label={tx(lang, 'Cảnh báo nhiệt / mất sóng', '温度逸脱・通信途絶アラート')}
          value={openAlerts}
          sub={tx(lang, `${alerts.length} tổng cảnh báo ghi nhận`, `累計記録アラート ${alerts.length} 件`)}
          tone={openAlerts > 0 ? 'rose' : 'default'}
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <StatCard
          label={tx(lang, 'Chuyến đang lăn bánh', '運行中の配送便')}
          value={activeTrips.length}
          sub={tx(
            lang,
            `${trips.filter((t) => t.isLateEta).length} chuyến cảnh báo trễ ETA`,
            `ETA遅延警告 ${trips.filter((t) => t.isLateEta).length} 便`
          )}
          tone="blue"
          icon={<Truck className="w-4 h-4" />}
        />
      </div>

      {/* 6 Steps & 5 Handovers Flow */}
      <Card
        title={tx(lang, 'Luồng vận hành 6 bước & 5 điểm bàn giao ePOD', '6ステップ運用フロー・5段階 ePOD 引渡管理')}
        subtitle={tx(
          lang,
          'Mỗi lần đổi tay sinh ra một biên bản ePOD bất biến và chuyển trách nhiệm bảo quản (BR-08)',
          '拠点間の引渡ごとに改変不可の ePOD 記録が発行され、保管責任が移転します (BR-08)'
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {SIX_STEPS.map((st, idx) => (
            <div
              key={st.step}
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-bold">
                    {st.step}
                  </span>
                  {idx < 5 && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
                  )}
                </div>
                <div className="text-xs font-bold text-slate-900">
                  {lang === 'ja' ? st.titleJa : st.titleVi}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {lang === 'ja' ? st.detailJa : st.detailVi}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Corridor Live Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title={tx(lang, 'Chuyến đang hoạt động trên hành lang', '回廊上の稼働中輸送便')}
          action={
            <Link
              href="/control-tower/warehouse-transport"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              {tx(lang, 'Điều phối chi tiết →', '配車詳細へ →')}
            </Link>
          }
        >
          <div className="space-y-3">
            {trips.slice(0, 4).map((trip) => (
              <div
                key={trip.id}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs font-bold text-slate-900">{trip.code}</div>
                  <div className="flex items-center gap-1.5">
                    {trip.isLateEta && <Badge tone="rose">{tx(lang, 'Trễ ETA (FR-25)', 'ETA遅延 (FR-25)')}</Badge>}
                    <TripStatusBadge status={trip.status} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span>
                    {tx(lang, 'Tải:', '積載:')}{' '}
                    <strong>{formatNum(trip.totalWeightKg, lang)} kg</strong> ({trip.fillRatePct}%)
                  </span>
                  <span>
                    {tx(lang, 'Số lô:', 'ロット数:')} <strong>{trip.assignments.length}</strong>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {trip.stops.map((s) => (
                    <span
                      key={s.stopOrder}
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border ${
                        s.actualCheckInTime
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      {s.actualCheckInTime ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <MapPin className="w-3 h-3" />
                      )}
                      {displayPlace(s.locationName, lang)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title={tx(lang, 'Lô hàng gần đây trong chuỗi', 'チェーン内の最新ロット')}
          action={
            <Link
              href="/control-tower/lots"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              {tx(lang, 'Xem tất cả →', 'すべて表示 →')}
            </Link>
          }
        >
          <div className="space-y-2.5">
            {dailyPilotLots.slice(0, 6).map((lot) => (
              <Link
                key={lot.id}
                href={`/control-tower/lots?lotId=${lot.id}`}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {lot.lotCode}
                    </span>
                    {lot.tempGroupId === 'TG-LANH' ? (
                      <Badge tone="blue">
                        <Snowflake className="w-3 h-3" /> 0–4°C
                      </Badge>
                    ) : (
                      <Badge tone="amber">10–13°C</Badge>
                    )}
                    {(lot.hasTempAlert || lot.hasDataGap) && (
                      <Badge tone="rose">{tx(lang, 'Cảnh báo', 'アラート')}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {displayPlace(lot.growingArea, lang)} · {formatNum(lot.currentKg, lang)} kg
                  </div>
                </div>
                <LotStatusBadge status={lot.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
