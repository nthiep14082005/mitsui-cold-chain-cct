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
import { Badge, LotStatusBadge } from '@/components/ui/Badge';
import { useCct } from '@/components/layout/CctContext';
import { tx } from '@/lib/i18n';
import { DailyOrder } from '@/types/order-plan';
import { Lot } from '@/types/lot-epod';
import { TempAlert, Trip } from '@/types/transport-temp';

const SIX_STEPS = [
  { step: 'B1', title: 'Tiếp nhận đơn & Kế hoạch', detail: 'Chốt trước 14:00 D-1' },
  { step: 'B2', title: 'Kết nối HTX & Thu gom', detail: 'Xác nhận sản lượng + VietGAP' },
  { step: 'B3', title: 'Sơ chế & Làm lạnh (BG1)', detail: 'Phân loại, dán QR, phòng mát' },
  { step: 'B4', title: 'Kho lạnh Bến Lức (BG2–3)', detail: 'Buồng theo nhóm nhiệt, FEFO' },
  { step: 'B5', title: 'Vận tải lạnh (BG4)', detail: 'Khóa ghép khoang BR-05, GPS' },
  { step: 'B6', title: 'Giao khách & ePOD (BG5)', detail: 'Ghi đạt/loại, khiếu nại 24h' },
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
          'Tài khoản Quản trị hệ thống chỉ quản lý danh mục & tham số (mục Danh mục & Quản trị), không truy cập dữ liệu vận hành.'
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
  }, [refreshTick, currentUser?.id]);

  if (errorMsg) {
    return (
      <Card title="Phân quyền Quản trị hệ thống (FR-51 / NFR-07)">
        <p className="text-sm text-slate-600 mb-3">{errorMsg}</p>
        <Link
          href="/control-tower/admin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
        >
          Đi tới Danh mục & Quản trị <ArrowRight className="w-4 h-4" />
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
          label="Lô đang theo dõi (thực địa)"
          value={dailyPilotLots.length}
          sub={`${(todayVolumeKg / 1000).toFixed(1)} tấn mẫu vận hành`}
          tone="emerald"
          icon={<Package className="w-4 h-4" />}
        />
        <StatCard
          label="Đơn phát sinh chờ duyệt"
          value={adHocCount}
          sub="Gửi sau giờ chốt 14:00 D-1"
          tone={adHocCount > 0 ? 'amber' : 'default'}
          icon={<ClipboardList className="w-4 h-4" />}
        />
        <StatCard
          label="Cảnh báo nhiệt / mất sóng"
          value={openAlerts}
          sub={`${alerts.length} tổng cảnh báo ghi nhận`}
          tone={openAlerts > 0 ? 'rose' : 'default'}
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <StatCard
          label="Chuyến đang lăn bánh"
          value={activeTrips.length}
          sub={`${trips.filter((t) => t.isLateEta).length} chuyến cảnh báo trễ ETA`}
          tone="blue"
          icon={<Truck className="w-4 h-4" />}
        />
      </div>

      {/* 6 Steps & 5 Handovers Flow */}
      <Card
        title="Luồng vận hành 6 bước & 5 điểm bàn giao ePOD"
        subtitle="Mỗi lần đổi tay sinh ra một biên bản ePOD bất biến và chuyển trách nhiệm bảo quản (BR-08)"
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
                <div className="text-xs font-bold text-slate-900">{st.title}</div>
                <div className="text-[11px] text-slate-500 mt-1">{st.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Corridor Live Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Chuyến đang hoạt động trên hành lang"
          action={
            <Link
              href="/control-tower/warehouse-transport"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Điều phối chi tiết →
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
                    {trip.isLateEta && <Badge tone="rose">Trễ ETA (FR-25)</Badge>}
                    <Badge tone={trip.status === 'DANG_CHAY' ? 'blue' : 'emerald'}>
                      {trip.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span>Tải: <strong>{trip.totalWeightKg.toLocaleString('vi-VN')} kg</strong> ({trip.fillRatePct}%)</span>
                  <span>Số lô: <strong>{trip.assignments.length}</strong></span>
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
                      {s.locationName}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Lô hàng gần đây trong chuỗi"
          action={
            <Link
              href="/control-tower/lots"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Xem tất cả →
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
                      <Badge tone="rose">Cảnh báo</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {lot.growingArea} · {lot.currentKg.toLocaleString('vi-VN')} kg
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
