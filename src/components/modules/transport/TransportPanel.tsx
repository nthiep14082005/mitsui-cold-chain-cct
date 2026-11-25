'use client';

import React, { useState } from 'react';
import { AlertOctagon, Plus, Truck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, TripStatusBadge, TripTypeBadge } from '@/components/ui/Badge';
import { useCct } from '@/components/layout/CctContext';
import {
  displayProductName,
  displayTempGroupName,
  formatNum,
  tx,
} from '@/lib/i18n';
import { Product, TempGroup, Vehicle } from '@/types/catalog';
import { Lot } from '@/types/lot-epod';
import { Trip, TripAssignment, TripType } from '@/types/transport-temp';

export function TransportPanel({
  vehicles,
  lots,
  products,
  tempGroups,
  trips,
}: {
  vehicles: Vehicle[];
  lots: Lot[];
  products: Product[];
  tempGroups: TempGroup[];
  trips: Trip[];
}) {
  const { pushToast, triggerRefresh, lang } = useCct();
  const [tripType, setTripType] = useState<TripType>('GIAO_HANG');
  const [vehicleId, setVehicleId] = useState(vehicles[1]?.id || vehicles[0]?.id || '');
  const [plannedDate, setPlannedDate] = useState('2026-11-26');
  const [targetTimeSlot, setTargetTimeSlot] = useState('06:00-08:00');
  const [assignments, setAssignments] = useState<TripAssignment[]>([]);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [selectedCompNo, setSelectedCompNo] = useState(1);
  const [br05Error, setBr05Error] = useState('');

  const availableLots = lots.filter(
    (l) =>
      l.childLotIds.length === 0 &&
      l.currentKg > 0 &&
      ['DA_TAO', 'DANG_LAM_LANH', 'TRONG_KHO', 'DANG_TRUNG_CHUYEN'].includes(l.status)
  );
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];
  const lotMap = new Map(lots.map((l) => [l.id, l]));
  const prodName = (id: string) => displayProductName(products.find((p) => p.id === id)?.name ?? id, lang);
  const tgName = (id: string) => displayTempGroupName(tempGroups.find((t) => t.id === id)?.name ?? id, lang);

  // Client-side pre-check matching server BR-05 so Dispatcher gets instant feedback
  const checkClientBr05 = (nextList: TripAssignment[]): string | null => {
    if (!selectedVehicle) return null;
    const byComp = new Map<number, Set<string>>();
    let total = 0;
    for (const a of nextList) {
      total += a.weightKg;
      const lot = lotMap.get(a.lotId);
      if (!lot) continue;
      const set = byComp.get(a.compartmentNo) ?? new Set<string>();
      set.add(lot.tempGroupId);
      byComp.set(a.compartmentNo, set);
      if (set.size > 1) {
        return tx(
          lang,
          `CHẶN BR-05: Không được xếp 2 lô khác nhóm nhiệt (Lạnh 0–4°C và Mát 10–13°C) vào cùng Khoang ${a.compartmentNo}!`,
          `BR-05ブロック: 異なる温度帯（冷蔵 0–4°C と 定温 10–13°C）のロットを同じ第${a.compartmentNo}室に混載できません！`
        );
      }
    }
    if (total > selectedVehicle.capacityKg) {
      return tx(
        lang,
        `CHẶN FR-23: Tổng tải (${total} kg) vượt tải trọng xe (${selectedVehicle.capacityKg} kg)!`,
        `FR-23ブロック: 総積載重量（${formatNum(total, lang)} kg）が車両最大積載量（${formatNum(selectedVehicle.capacityKg, lang)} kg）を超過しています！`
      );
    }
    return null;
  };

  const handleAddAssignment = () => {
    setBr05Error('');
    const lot = lotMap.get(selectedLotId);
    if (!lot) return;
    if (assignments.some((a) => a.lotId === lot.id)) {
      return setBr05Error(
        tx(lang, 'Lô này đã được thêm vào chuyến.', 'このロットはすでに配車リストに追加されています。')
      );
    }
    const next = [
      ...assignments,
      { lotId: lot.id, compartmentNo: selectedCompNo, weightKg: lot.currentKg },
    ];
    const err = checkClientBr05(next);
    if (err) {
      setBr05Error(err);
      pushToast('error', err);
      return;
    }
    setAssignments(next);
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setBr05Error('');
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripType,
        vehicleId: selectedVehicle?.id,
        plannedDate,
        targetTimeSlot,
        assignments,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || tx(lang, 'Lỗi tạo chuyến', '配車便作成エラー');
      setBr05Error(msg);
      pushToast('error', msg);
      return;
    }
    pushToast(
      'success',
      tx(
        lang,
        `Đã tạo chuyến ${data.trip.code} (Lấp đầy ${data.trip.fillRatePct}%)`,
        `配車便 ${data.trip.code} を発行しました（積載率 ${data.trip.fillRatePct}%）`
      )
    );
    setAssignments([]);
    triggerRefresh();
  };

  const totalDraftKg = assignments.reduce((s, a) => s + a.weightKg, 0);
  const draftFillPct = selectedVehicle
    ? Math.round((totalDraftKg / selectedVehicle.capacityKg) * 1000) / 10
    : 0;

  return (
    <div className="space-y-4">
      {/* Manual Trip Builder (FR-22, FR-23, BR-05) */}
      <Card
        title={tx(lang, 'Xếp chuyến thủ công & Kiểm tra BR-05 (FR-22, FR-23)', '手動配車・積載計画・BR-05チェック (FR-22, FR-23)')}
        subtitle={tx(
          lang,
          'Chặn cứng xếp lô Lạnh (0–4°C) và Mát (10–13°C) vào cùng khoang xe; chặn vượt tải trọng',
          '同一荷室への冷蔵(0–4°C)・定温(10–13°C)混載をハードブロック、および過積載を防止'
        )}
      >
        <form onSubmit={handleCreateTrip} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {tx(lang, 'Loại chuyến', '便種別')}
              </label>
              <select
                value={tripType}
                onChange={(e) => setTripType(e.target.value as TripType)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="THU_GOM">{tx(lang, 'Thu gom (HTX → Sơ chế)', '集荷輸送 (HTX → 選果場)')}</option>
                <option value="TRUNG_CHUYEN">
                  {tx(lang, 'Trung chuyển (Sơ chế → Kho Bến Lức)', '中継輸送 (選果場 → ベンルック倉庫)')}
                </option>
                <option value="GIAO_HANG">
                  {tx(lang, 'Giao hàng (Kho Bến Lức → TP.HCM)', '店舗配送 (ベンルック倉庫 → ホーチミン)')}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {tx(lang, 'Xe & Khoang', '車両・荷室数')}
              </label>
              <select
                value={selectedVehicle?.id ?? ''}
                onChange={(e) => {
                  setVehicleId(e.target.value);
                  setAssignments([]);
                  setSelectedCompNo(1);
                  setBr05Error('');
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} ({formatNum(v.capacityKg, lang)} kg · {v.compartments.length}{' '}
                    {tx(lang, 'khoang', '室')})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {tx(lang, 'Ngày chạy', '運行予定日')}
              </label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {tx(lang, 'Khung giờ mục tiêu', '目標納品時間帯')}
              </label>
              <input
                type="text"
                value={targetTimeSlot}
                onChange={(e) => setTargetTimeSlot(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-semibold text-slate-700">
              {tx(
                lang,
                'Chọn lô hàng gán vào khoang xe (để test BR-05, hãy thử gán 1 lô Lạnh và 1 lô Mát vào cùng Khoang 1):',
                '荷室に割り当てるロットを選択（BR-05の検証：冷蔵ロットと定温ロットを同じ第1室へ追加してみてください）:'
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={selectedLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                className="flex-1 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">{tx(lang, '-- Chọn lô hàng --', '-- ロットを選択 --')}</option>
                {availableLots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lotCode} · {prodName(l.productId)} · {tgName(l.tempGroupId)} ·{' '}
                    {formatNum(l.currentKg, lang)} kg
                  </option>
                ))}
              </select>

              <select
                value={selectedCompNo}
                onChange={(e) => setSelectedCompNo(Number(e.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {(selectedVehicle?.compartments ?? []).map((c) => (
                  <option key={c.compartmentNo} value={c.compartmentNo}>
                    {tx(
                      lang,
                      `Khoang ${c.compartmentNo} (tối đa ${c.capacityKg} kg)`,
                      `第${c.compartmentNo}室 (最大 ${formatNum(c.capacityKg, lang)} kg)`
                    )}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddAssignment}
                disabled={!selectedLotId}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" /> {tx(lang, 'Gán vào khoang', '荷室へ割当')}
              </button>
            </div>

            {br05Error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold">
                <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{br05Error}</span>
              </div>
            )}

            {assignments.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span>
                    {tx(lang, 'Tổng khối lượng:', '合計重量:')}{' '}
                    <strong>{formatNum(totalDraftKg, lang)} kg</strong> /{' '}
                    {selectedVehicle ? formatNum(selectedVehicle.capacityKg, lang) : 0} kg
                  </span>
                  <span className="font-bold text-emerald-700">
                    {tx(lang, `Tỷ lệ lấp đầy: ${draftFillPct}%`, `積載率: ${draftFillPct}%`)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {assignments.map((a) => {
                    const lot = lotMap.get(a.lotId);
                    return (
                      <div
                        key={a.lotId}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs"
                      >
                        <span className="font-mono font-bold">{lot?.lotCode}</span>
                        <Badge tone={lot?.tempGroupId === 'TG-LANH' ? 'blue' : 'amber'}>
                          {tx(lang, `Khoang ${a.compartmentNo}`, `第${a.compartmentNo}室`)} ·{' '}
                          {lot ? tgName(lot.tempGroupId) : ''}
                        </Badge>
                        <span>{formatNum(a.weightKg, lang)} kg</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAssignments((prev) => prev.filter((x) => x.lotId !== a.lotId))
                          }
                          className="text-slate-400 hover:text-rose-600"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={assignments.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40"
            >
              <Truck className="w-4 h-4" /> {tx(lang, 'Phát hành lệnh chuyến', '配車指示を発行')}
            </button>
          </div>
        </form>
      </Card>

      {/* Trips List */}
      <Card title={tx(lang, 'Danh sách chuyến vận tải lạnh', '冷蔵輸送便一覧')}>
        <div className="space-y-3">
          {trips.map((t) => {
            const veh = vehicles.find((v) => v.id === t.vehicleId);
            return (
              <div
                key={t.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{t.code}</span>
                    <TripTypeBadge tripType={t.tripType} />
                    <TripStatusBadge status={t.status} />
                    {t.isLateEta && (
                      <Badge tone="rose">{tx(lang, 'Trễ ETA dự kiến', 'ETA遅延見込')}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">
                    {tx(lang, 'Xe', '車両')} <strong>{veh?.plateNumber ?? t.vehicleId}</strong> ·{' '}
                    {tx(lang, 'Tải', '積載')}{' '}
                    <strong>{formatNum(t.totalWeightKg, lang)} kg</strong> (
                    {tx(lang, 'Lấp đầy', '積載率')} <strong>{t.fillRatePct}%</strong>) ·{' '}
                    {t.assignments.length} {tx(lang, 'lô', 'ロット')}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {tx(lang, 'Ngày:', '運行日:')} <strong>{t.plannedDate}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
