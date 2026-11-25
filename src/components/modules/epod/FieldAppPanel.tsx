'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  PackagePlus,
  QrCode,
  RefreshCw,
  Snowflake,
  Truck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, LotStatusBadge } from '@/components/ui/Badge';
import { QrCodeModal } from '@/components/ui/QrCodeModal';
import { useCct } from '@/components/layout/CctContext';
import { HandoverStage, Lot } from '@/types/lot-epod';
import { Organization } from '@/types/common';
import { Product, TempGroup } from '@/types/catalog';
import { SupplyPlan } from '@/types/order-plan';
import { TempAlert, Trip } from '@/types/transport-temp';
import { Claim } from '@/types/claim-billing-kpi';

interface OfflineQueueItem {
  idempotencyKey: string;
  kind: 'EPOD' | 'TRIP_CHECKIN';
  payload: Record<string, unknown>;
  recordedAt: string;
  label: string;
}

const OFFLINE_STORAGE_KEY = 'cct_field_offline_queue';

export function FieldAppPanel() {
  const { currentUser, currentOrg, demoUsers, switchUser, refreshTick, pushToast, triggerRefresh } =
    useCct();

  const [isOffline, setIsOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  const [lots, setLots] = useState<Lot[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tempGroups, setTempGroups] = useState<TempGroup[]>([]);
  const [plans, setPlans] = useState<SupplyPlan[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [alerts, setAlerts] = useState<TempAlert[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [fefoQueue, setFefoQueue] = useState<Array<{ lotId: string; isWarning: boolean; usagePct: number }>>([]);

  // Handover Form (BG1-BG5)
  const [selectedLotId, setSelectedLotId] = useState('');
  const [stage, setStage] = useState<HandoverStage>('BG2');
  const [actualKg, setActualKg] = useState('750');
  const [measuredTempC, setMeasuredTempC] = useState('2.6');
  const [chamberId, setChamberId] = useState('CH-NECS-C1');
  const [varianceReason, setVarianceReason] = useState('');
  const [acceptedKg, setAcceptedKg] = useState('750');
  const [rejectedKg, setRejectedKg] = useState('0');
  const [qrLot, setQrLot] = useState<Lot | null>(null);

  // Sorting & Create Lot Form (NHAN_VIEN_SO_CHE)
  const [sortSupplierId, setSortSupplierId] = useState('ORG-HTX-TG');
  const [sortProductId, setSortProductId] = useState('PROD-CAIXANH');
  const [sortRawKg, setSortRawKg] = useState('800');
  const [sortAcceptedKg, setSortAcceptedKg] = useState('740');
  const [sortRejectReason, setSortRejectReason] = useState('Lá già úa');

  // HTX Confirm Form
  const [originArea, setOriginArea] = useState('Châu Thành, Tiền Giang');
  const [originCert, setOriginCert] = useState('VietGAP-TG-2026');

  // Partner Explanation
  const [explainText, setExplainText] = useState('');

  // Load offline queue from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(OFFLINE_STORAGE_KEY);
      if (raw) setOfflineQueue(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const saveQueue = (next: OfflineQueueItem[]) => {
    setOfflineQueue(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(next));
    }
  };

  const flushOfflineQueue = useCallback(async () => {
    if (!offlineQueue.length || syncing) return;
    setSyncing(true);
    try {
      const epodItems = offlineQueue.filter((q) => q.kind === 'EPOD');
      const checkInItems = offlineQueue.filter((q) => q.kind === 'TRIP_CHECKIN');

      if (epodItems.length) {
        const res = await fetch('/api/epods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            records: epodItems.map((i) => ({
              ...i.payload,
              idempotencyKey: i.idempotencyKey,
              recordedAt: i.recordedAt,
              isOfflineRecorded: true,
            })),
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          pushToast('error', err.error || 'Lỗi đồng bộ ePOD ngoại tuyến');
          setSyncing(false);
          return;
        }
      }

      for (const ci of checkInItems) {
        await fetch(`/api/trips/${String(ci.payload.tripId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'CHECK_IN',
            stopOrder: ci.payload.stopOrder,
            gpsLat: ci.payload.gpsLat,
            gpsLng: ci.payload.gpsLng,
            recordedAt: ci.recordedAt,
          }),
        });
      }

      const syncedCount = offlineQueue.length;
      saveQueue([]);
      pushToast('success', `Đã tự động đồng bộ ${syncedCount} bản ghi ngoại tuyến lên máy chủ!`);
      triggerRefresh();
    } finally {
      setSyncing(false);
    }
  }, [offlineQueue, syncing, pushToast, triggerRefresh]);

  // Auto-sync when toggling back online
  useEffect(() => {
    if (!isOffline && offlineQueue.length > 0) {
      flushOfflineQueue();
    }
  }, [isOffline, offlineQueue.length, flushOfflineQueue]);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    const [cRes, lRes, pRes, tRes, aRes, clRes] = await Promise.all([
      fetch('/api/catalog', { cache: 'no-store' }),
      fetch('/api/lots', { cache: 'no-store' }),
      fetch('/api/plans', { cache: 'no-store' }),
      fetch('/api/trips', { cache: 'no-store' }),
      fetch('/api/telemetry', { cache: 'no-store' }),
      fetch('/api/claims', { cache: 'no-store' }),
    ]);

    if (cRes.ok) {
      const cat = await cRes.json();
      setOrgs(cat.organizations ?? []);
      setProducts(cat.products ?? []);
      setTempGroups(cat.tempGroups ?? []);
    }
    if (lRes.ok) {
      const lData = await lRes.json();
      const validLots = (lData.lots ?? []).filter(
        (l: Lot) => l.childLotIds.length === 0 && !l.id.startsWith('LOT-NOV-')
      );
      setLots(validLots);
      setFefoQueue(lData.fefoQueue ?? []);
      if (!selectedLotId && validLots[0]) setSelectedLotId(validLots[0].id);
    }
    if (pRes.ok) setPlans((await pRes.json()).plans ?? []);
    if (tRes.ok) setTrips((await tRes.json()).trips ?? []);
    if (aRes.ok) setAlerts((await aRes.json()).alerts ?? []);
    if (clRes.ok) setClaims((await clRes.json()).claims ?? []);
  }, [currentUser, selectedLotId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTick]);

  const fieldRoles = demoUsers.filter((u) =>
    ['NHA_CUNG_CAP', 'NHAN_VIEN_SO_CHE', 'NHAN_VIEN_KHO', 'TAI_XE'].includes(u.role)
  );
  const prodName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const tgName = (id: string) => tempGroups.find((t) => t.id === id)?.name ?? id;
  const selectedLot = lots.find((l) => l.id === selectedLotId) ?? lots[0];

  // Auto-suggest next BG stage when lot changes
  useEffect(() => {
    if (!selectedLot) return;
    if (selectedLot.status === 'DA_TAO' || selectedLot.status === 'DANG_LAM_LANH') setStage('BG2');
    else if (selectedLot.status === 'DANG_TRUNG_CHUYEN') setStage('BG3');
    else if (selectedLot.status === 'TRONG_KHO') setStage('BG4');
    else if (selectedLot.status === 'DANG_GIAO') setStage('BG5');
    setActualKg(String(selectedLot.currentKg));
    setAcceptedKg(String(selectedLot.currentKg));
    setRejectedKg('0');
  }, [selectedLot]);

  const handleSubmitEpod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;
    const nowIso = new Date().toISOString();
    const idemKey = `field-${selectedLot.id}-${stage}-${Date.now()}`;
    const payload: Record<string, unknown> = {
      idempotencyKey: idemKey,
      stage,
      lotId: selectedLot.id,
      actualKg: Number(actualKg),
      measuredTempC: Number(measuredTempC),
      chamberId: stage === 'BG3' ? chamberId : undefined,
      varianceReason: varianceReason.trim() || undefined,
      acceptedKg: stage === 'BG5' ? Number(acceptedKg) : undefined,
      rejectedKg: stage === 'BG5' ? Number(rejectedKg) : undefined,
      qcRejectionReason: stage === 'BG5' && Number(rejectedKg) > 0 ? varianceReason || 'Hàng không đạt' : undefined,
      confirmBothParties: true,
    };

    if (isOffline) {
      const next: OfflineQueueItem[] = [
        ...offlineQueue,
        {
          idempotencyKey: idemKey,
          kind: 'EPOD',
          payload,
          recordedAt: nowIso,
          label: `${stage} · ${selectedLot.lotCode} (${actualKg} kg, ${measuredTempC}°C)`,
        },
      ];
      saveQueue(next);
      pushToast('warning', `Đang mất sóng: Đã lưu ${stage} vào hàng đợi thiết bị (sẽ tự đồng bộ khi có mạng).`);
      return;
    }

    const res = await fetch('/api/epods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi ghi biên bản');
    if (data.warnings?.length) {
      pushToast('warning', data.warnings[0]);
    } else {
      pushToast('success', `Đã ký bàn giao ${stage} lô ${selectedLot.lotCode} thành công!`);
    }
    setVarianceReason('');
    triggerRefresh();
  };

  const handleCreateLot = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/lots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierOrgId: sortSupplierId,
        productId: sortProductId,
        rawInputKg: Number(sortRawKg),
        acceptedKg: Number(sortAcceptedKg),
        rejectedKg: Math.max(0, Number(sortRawKg) - Number(sortAcceptedKg)),
        rejectionReason: sortRejectReason,
        growingArea: 'ĐBSCL',
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi tạo lô');
    pushToast('success', `Đã tạo lô ${data.lot.lotCode} & sinh mã QR!`);
    setQrLot(data.lot);
    triggerRefresh();
  };

  const handleCoolingAction = async (lotId: string, action: 'ENTER_COOLING' | 'EXIT_COOLING') => {
    const res = await fetch(`/api/lots/${lotId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return pushToast('error', 'Lỗi cập nhật phòng mát');
    pushToast('success', action === 'ENTER_COOLING' ? 'Đã đưa lô vào phòng mát (FR-17)' : 'Đã xuất phòng mát');
    triggerRefresh();
  };

  const handleTripAction = async (
    tripId: string,
    action: 'ACCEPT' | 'START' | 'CHECK_IN' | 'COMPLETE',
    stopOrder?: number
  ) => {
    if (isOffline && action === 'CHECK_IN') {
      const nowIso = new Date().toISOString();
      saveQueue([
        ...offlineQueue,
        {
          idempotencyKey: `checkin-${tripId}-${stopOrder}-${Date.now()}`,
          kind: 'TRIP_CHECKIN',
          payload: { tripId, stopOrder, gpsLat: 10.6352, gpsLng: 106.4847 },
          recordedAt: nowIso,
          label: `GPS Check-in chuyến ${tripId} (Điểm #${stopOrder})`,
        },
      ]);
      pushToast('warning', 'Đang mất sóng: Đã lưu Check-in GPS vào hàng đợi ngoại tuyến.');
      return;
    }

    const res = await fetch(`/api/trips/${tripId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        stopOrder,
        gpsLat: 10.6352,
        gpsLng: 106.4847,
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi cập nhật chuyến');
    pushToast('success', `Đã cập nhật chuyến ${data.trip.code}`);
    triggerRefresh();
  };

  const handleHtxConfirm = async (planId: string, allocationId: string, kg: number) => {
    const res = await fetch(`/api/plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allocationId,
        confirmationStatus: 'DA_XAC_NHAN',
        confirmedKg: kg,
        originDeclaration: {
          growingArea: originArea,
          harvestDate: '2026-11-25',
          certCode: originCert,
        },
      }),
    });
    if (!res.ok) return pushToast('error', 'Lỗi xác nhận HTX');
    pushToast('success', 'HTX đã xác nhận sản lượng & khai báo nguồn gốc (FR-11, FR-13)');
    triggerRefresh();
  };

  const handleSubmitExplanation = async (claimId: string) => {
    if (!explainText.trim()) return;
    const res = await fetch(`/api/claims/${claimId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'PARTNER_EXPLAIN', explanationContent: explainText }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi gửi giải trình');
    pushToast('success', 'Đã gửi giải trình lên Quản lý QC Mitsui (FR-39)');
    setExplainText('');
    triggerRefresh();
  };

  const warehouseChambers = orgs.find((o) => o.id === 'ORG-WH-NECS')?.chambers ?? [];
  const selectedChamberObj = warehouseChambers.find((c) => c.id === chamberId);
  const wrongTempChamberWarning =
    stage === 'BG3' &&
    selectedLot &&
    selectedChamberObj &&
    selectedChamberObj.tempGroupId !== selectedLot.tempGroupId;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Top Offline Mode Banner + Role Quick Switcher */}
      <div
        className={`rounded-2xl border-2 p-4 shadow-sm flex flex-col gap-3 ${
          isOffline
            ? 'border-rose-400 bg-rose-50'
            : 'border-emerald-300 bg-emerald-50/70'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isOffline ? (
              <WifiOff className="w-5 h-5 text-rose-700" />
            ) : (
              <Wifi className="w-5 h-5 text-emerald-700" />
            )}
            <div>
              <div className="text-sm font-bold text-slate-900">
                {isOffline ? 'CHẾ ĐỘ MẤT SÓNG (OFFLINE 24H)' : 'ĐANG TRỰC TUYẾN'}
              </div>
              <div className="text-xs text-slate-600">
                {currentOrg?.name} · {currentUser?.name}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsOffline((v) => !v)}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs ${
              isOffline ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {isOffline ? 'Bật lại mạng (Tự đồng bộ)' : 'Giả lập mất sóng (FR-33)'}
          </button>
        </div>

        {offlineQueue.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-300 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-amber-800">
              <span>Hàng đợi ngoại tuyến: {offlineQueue.length} bản ghi</span>
              {!isOffline && (
                <button
                  onClick={flushOfflineQueue}
                  className="inline-flex items-center gap-1 text-emerald-700 underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ ngay
                </button>
              )}
            </div>
            {offlineQueue.map((q) => (
              <div key={q.idempotencyKey} className="text-xs text-slate-600">
                • {q.label} (ghi lúc {new Date(q.recordedAt).toLocaleTimeString('vi-VN')})
              </div>
            ))}
          </div>
        )}

        {/* Quick Field Role Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {fieldRoles.map((u) => (
            <button
              key={u.id}
              onClick={() => switchUser(u.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                currentUser?.id === u.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {u.role === 'NHA_CUNG_CAP'
                ? 'HTX'
                : u.role === 'NHAN_VIEN_SO_CHE'
                  ? 'Sơ chế'
                  : u.role === 'NHAN_VIEN_KHO'
                    ? 'Kho lạnh'
                    : 'Tài xế'}{' '}
              ({u.orgName.split(' ')[0]})
            </button>
          ))}
        </div>
      </div>

      {/* 1. Handover ePOD BG1-BG5 (<=5 steps, big touch targets NFR-10) */}
      <Card
        title="Bàn giao điện tử ePOD (Tối đa 5 bước · NFR-10)"
        subtitle="Chọn lô → Chọn điểm BG1–BG5 → Nhập kg & nhiệt độ → Xác nhận"
      >
        <form onSubmit={handleSubmitEpod} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">1. Chọn / Quét lô hàng</label>
            <select
              value={selectedLot?.id ?? ''}
              onChange={(e) => setSelectedLotId(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold"
            >
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lotCode} · {prodName(l.productId)} · {l.currentKg} kg ({l.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">2. Điểm bàn giao (BG1–BG5)</label>
            <div className="grid grid-cols-5 gap-1.5">
              {(['BG1', 'BG2', 'BG3', 'BG4', 'BG5'] as HandoverStage[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStage(st)}
                  className={`min-h-[44px] rounded-xl text-xs font-bold border ${
                    stage === st
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">3. Khối lượng thực (kg)</label>
              <input
                type="number"
                step="0.1"
                value={actualKg}
                onChange={(e) => setActualKg(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">4. Nhiệt độ đo (°C)</label>
              <input
                type="number"
                step="0.1"
                value={measuredTempC}
                onChange={(e) => setMeasuredTempC(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold"
                required
              />
            </div>
          </div>

          {stage === 'BG3' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Chọn buồng kho nhập (FR-18)
              </label>
              <select
                value={chamberId}
                onChange={(e) => setChamberId(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-slate-300 px-3 text-sm font-medium"
              >
                {warehouseChambers.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} ({tgName(ch.tempGroupId)})
                  </option>
                ))}
              </select>
              {wrongTempChamberWarning && (
                <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  CẢNH BÁO FR-18 / BR-05: Buồng này KHÁC nhóm nhiệt của lô hàng!
                </div>
              )}
            </div>
          )}

          {stage === 'BG5' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kg Đạt</label>
                <input
                  type="number"
                  value={acceptedKg}
                  onChange={(e) => setAcceptedKg(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kg Không đạt</label>
                <input
                  type="number"
                  value={rejectedKg}
                  onChange={(e) => setRejectedKg(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú / Lý do (bắt buộc nếu lệch &gt;2% hoặc ngoài dải nhiệt)
            </label>
            <input
              type="text"
              value={varianceReason}
              onChange={(e) => setVarianceReason(e.target.value)}
              placeholder="Nhập lý do nếu có chênh lệch..."
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full min-h-[52px] rounded-xl bg-emerald-600 text-white text-base font-bold hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" /> 5. Xác nhận điện tử ePOD {stage}
          </button>
        </form>
      </Card>

      {/* 2. Role-Adaptive Task Cards */}
      {currentUser?.role === 'NHA_CUNG_CAP' && (
        <Card title="Kế hoạch thu hoạch & Khai báo nguồn gốc HTX (FR-11, FR-13)">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={originArea}
                onChange={(e) => setOriginArea(e.target.value)}
                placeholder="Vùng trồng"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={originCert}
                onChange={(e) => setOriginCert(e.target.value)}
                placeholder="Chứng nhận VietGAP"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            {plans.flatMap((p) =>
              p.allocations.map((a) => (
                <div key={a.id} className="p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between font-bold">
                    <span>{prodName(a.productId)} ({p.planDate})</span>
                    <Badge tone={a.confirmationStatus === 'DA_XAC_NHAN' ? 'emerald' : 'amber'}>
                      {a.confirmationStatus}
                    </Badge>
                  </div>
                  <div>Yêu cầu thu hoạch: <strong>{a.requiredRawKg} kg</strong></div>
                  <button
                    onClick={() => handleHtxConfirm(p.id, a.id, a.requiredRawKg)}
                    className="w-full min-h-[42px] rounded-xl bg-emerald-600 text-white font-bold"
                  >
                    Xác nhận đủ {a.requiredRawKg} kg & Gửi nguồn gốc
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {currentUser?.role === 'NHAN_VIEN_SO_CHE' && (
        <>
          <Card title="Phân loại, Tạo lô mới & In tem QR (FR-15, FR-16)">
            <form onSubmit={handleCreateLot} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={sortSupplierId}
                  onChange={(e) => setSortSupplierId(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-2.5 text-xs font-semibold"
                >
                  {orgs
                    .filter((o) => o.type === 'NHA_CUNG_CAP')
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
                <select
                  value={sortProductId}
                  onChange={(e) => setSortProductId(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-2.5 text-xs font-semibold"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">Hàng thô BG1 (kg)</label>
                  <input
                    type="number"
                    value={sortRawKg}
                    onChange={(e) => setSortRawKg(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">Kg Đạt (tạo lô)</label>
                  <input
                    type="number"
                    value={sortAcceptedKg}
                    onChange={(e) => setSortAcceptedKg(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold"
                  />
                </div>
              </div>
              <input
                type="text"
                value={sortRejectReason}
                onChange={(e) => setSortRejectReason(e.target.value)}
                placeholder="Lý do loại"
                className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 text-xs"
              />
              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <PackagePlus className="w-4 h-4" /> Tạo lô & Sinh tem QR
              </button>
            </form>
          </Card>

          <Card title="Phòng mát & In lại tem QR lô của cơ sở (FR-17)">
            <div className="space-y-2.5">
              {lots.slice(0, 5).map((l) => (
                <div key={l.id} className="p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs font-bold">{l.lotCode}</div>
                    <div className="text-xs text-slate-500">{prodName(l.productId)} · {l.currentKg} kg</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setQrLot(l)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold inline-flex items-center gap-1"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Tem QR
                    </button>
                    {l.status === 'DA_TAO' && (
                      <button
                        onClick={() => handleCoolingAction(l.id, 'ENTER_COOLING')}
                        className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Snowflake className="w-3.5 h-3.5" /> Vào phòng mát
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {currentUser?.role === 'NHAN_VIEN_KHO' && (
        <Card title="Tồn kho ưu tiên xuất FEFO (FR-19, FR-20)">
          <div className="space-y-2.5">
            {fefoQueue.map((item, idx) => {
              const l = lots.find((x) => x.id === item.lotId);
              if (!l) return null;
              return (
                <div key={l.id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone="slate">FEFO #{idx + 1}</Badge>
                      <span className="font-mono text-xs font-bold">{l.lotCode}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {prodName(l.productId)} · {l.currentKg} kg
                    </div>
                  </div>
                  {item.isWarning && <Badge tone="rose">Lưu {item.usagePct}%</Badge>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {currentUser?.role === 'TAI_XE' && (
        <Card title="Lệnh chuyến & Check-in GPS (FR-24, NFR-09)">
          <div className="space-y-3">
            {trips.map((t) => (
              <div key={t.id} className="p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-600" /> {t.code}
                  </span>
                  <Badge tone={t.status === 'DANG_CHAY' ? 'blue' : 'emerald'}>{t.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {t.status === 'MOI_TAO' && (
                    <button
                      onClick={() => handleTripAction(t.id, 'START')}
                      className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                    >
                      Nhận lệnh & Bắt đầu chạy
                    </button>
                  )}
                  {t.stops.map((s) => (
                    <button
                      key={s.stopOrder}
                      onClick={() => handleTripAction(t.id, 'CHECK_IN', s.stopOrder)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 border ${
                        s.actualCheckInTime
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-900 text-white border-slate-900'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {s.actualCheckInTime ? `Đã check-in: ${s.locationName}` : `Check-in GPS: ${s.locationName}`}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Partner Claims Explanation (FR-39) & Alerts */}
      {claims.filter((c) => c.status !== 'DA_PHAN_QUYET').length > 0 && (
        <Card title="Khiếu nại đề xuất liên quan (Giải trình trong 48h — FR-39)">
          <div className="space-y-3">
            {claims
              .filter((c) => c.status !== 'DA_PHAN_QUYET')
              .map((c) => (
                <div key={c.id} className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2 text-xs">
                  <div className="font-bold text-amber-900">{c.code} · {c.systemSuggestedStage}</div>
                  <p className="text-amber-800">{c.systemSuggestionDetail}</p>
                  {c.partnerExplanation ? (
                    <div className="text-emerald-700 font-semibold">
                      Đã gửi giải trình: {c.partnerExplanation.content}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={explainText}
                        onChange={(e) => setExplainText(e.target.value)}
                        placeholder="Nhập giải trình của đối tác..."
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <button
                        onClick={() => handleSubmitExplanation(c.id)}
                        className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold"
                      >
                        Gửi giải trình
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Alerts of current partner */}
      {alerts.length > 0 && (
        <Card title="Cảnh báo nhiệt độ của đơn vị">
          <div className="space-y-2">
            {alerts.slice(0, 5).map((a) => (
              <div key={a.id} className="p-3 rounded-xl border border-rose-200 bg-rose-50/40 text-xs flex justify-between">
                <div>
                  <strong>{a.stage}</strong> · {a.durationMinutes} phút
                </div>
                <Badge tone={a.acknowledgedAt ? 'emerald' : 'rose'}>
                  {a.acknowledgedAt ? 'Đã xử lý' : 'Chưa xác nhận'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {qrLot && (
        <QrCodeModal
          open={Boolean(qrLot)}
          onClose={() => setQrLot(null)}
          lotCode={qrLot.lotCode}
          qrToken={qrLot.qrToken}
          productName={prodName(qrLot.productId)}
          packingDate={qrLot.packingDate}
          weightKg={qrLot.currentKg}
        />
      )}
    </div>
  );
}
