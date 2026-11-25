'use client';

import React, { useState } from 'react';
import { AlertOctagon, Plus, Truck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useCct } from '@/components/layout/CctContext';
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
  const { pushToast, triggerRefresh } = useCct();
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
  const prodName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const tgName = (id: string) => tempGroups.find((t) => t.id === id)?.name ?? id;

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
        return `CHẶN BR-05: Không được xếp 2 lô khác nhóm nhiệt (Lạnh 0–4°C và Mát 10–13°C) vào cùng Khoang ${a.compartmentNo}!`;
      }
    }
    if (total > selectedVehicle.capacityKg) {
      return `CHẶN FR-23: Tổng tải (${total} kg) vượt tải trọng xe (${selectedVehicle.capacityKg} kg)!`;
    }
    return null;
  };

  const handleAddAssignment = () => {
    setBr05Error('');
    const lot = lotMap.get(selectedLotId);
    if (!lot) return;
    if (assignments.some((a) => a.lotId === lot.id)) {
      return setBr05Error('Lô này đã được thêm vào chuyến.');
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
      setBr05Error(data.error || 'Lỗi tạo chuyến');
      pushToast('error', data.error || 'Lỗi tạo chuyến');
      return;
    }
    pushToast('success', `Đã tạo chuyến ${data.trip.code} (Lấp đầy ${data.trip.fillRatePct}%)`);
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
        title="Xếp chuyến thủ công & Kiểm tra BR-05 (FR-22, FR-23)"
        subtitle="Chặn cứng xếp lô Lạnh (0–4°C) và Mát (10–13°C) vào cùng khoang xe; chặn vượt tải trọng"
      >
        <form onSubmit={handleCreateTrip} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Loại chuyến</label>
              <select
                value={tripType}
                onChange={(e) => setTripType(e.target.value as TripType)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="THU_GOM">Thu gom (HTX → Sơ chế)</option>
                <option value="TRUNG_CHUYEN">Trung chuyển (Sơ chế → Kho Bến Lức)</option>
                <option value="GIAO_HANG">Giao hàng (Kho Bến Lức → TP.HCM)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Xe & Khoang</label>
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
                    {v.plateNumber} ({v.capacityKg.toLocaleString('vi-VN')} kg · {v.compartments.length} khoang)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ngày chạy</label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Khung giờ mục tiêu</label>
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
              Chọn lô hàng gán vào khoang xe (để test BR-05, hãy thử gán 1 lô Lạnh và 1 lô Mát vào cùng Khoang 1):
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={selectedLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                className="flex-1 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">-- Chọn lô hàng --</option>
                {availableLots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lotCode} · {prodName(l.productId)} · {tgName(l.tempGroupId)} · {l.currentKg} kg
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
                    Khoang {c.compartmentNo} (tối đa {c.capacityKg} kg)
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddAssignment}
                disabled={!selectedLotId}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" /> Gán vào khoang
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
                    Tổng khối lượng: <strong>{totalDraftKg.toLocaleString('vi-VN')} kg</strong> /{' '}
                    {selectedVehicle?.capacityKg.toLocaleString('vi-VN')} kg
                  </span>
                  <span className="font-bold text-emerald-700">Tỷ lệ lấp đầy: {draftFillPct}%</span>
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
                          Khoang {a.compartmentNo} · {lot ? tgName(lot.tempGroupId) : ''}
                        </Badge>
                        <span>{a.weightKg} kg</span>
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
              <Truck className="w-4 h-4" /> Phát hành lệnh chuyến
            </button>
          </div>
        </form>
      </Card>

      {/* Trips List */}
      <Card title="Danh sách chuyến vận tải lạnh">
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
                    <Badge tone="slate">{t.tripType}</Badge>
                    <Badge tone={t.status === 'DANG_CHAY' ? 'blue' : 'emerald'}>{t.status}</Badge>
                    {t.isLateEta && <Badge tone="rose">Trễ ETA dự kiến</Badge>}
                  </div>
                  <div className="text-xs text-slate-600">
                    Xe <strong>{veh?.plateNumber ?? t.vehicleId}</strong> · Tải{' '}
                    <strong>{t.totalWeightKg.toLocaleString('vi-VN')} kg</strong> (Lấp đầy{' '}
                    <strong>{t.fillRatePct}%</strong>) · {t.assignments.length} lô
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  Ngày: <strong>{t.plannedDate}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
