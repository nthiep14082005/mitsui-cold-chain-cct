'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
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
import { AllocConfirmBadge, Badge, TripStatusBadge } from '@/components/ui/Badge';
import { QrCodeModal } from '@/components/ui/QrCodeModal';
import { useCct } from '@/components/layout/CctContext';
import {
  displayOperationalText,
  displayOrgName,
  displayPlace,
  displayProductName,
  displayTempGroupName,
  displayUserName,
  formatNum,
  formatTime,
  LOT_STATUS_I18N,
  tx,
} from '@/lib/i18n';
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
  const { currentUser, currentOrg, demoUsers, switchUser, refreshTick, pushToast, triggerRefresh, lang } =
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
          pushToast('error', err.error || tx(lang, 'Lỗi đồng bộ ePOD ngoại tuyến', 'オフラインePOD同期エラー'));
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
      pushToast(
        'success',
        tx(
          lang,
          `Đã tự động đồng bộ ${syncedCount} bản ghi ngoại tuyến lên máy chủ!`,
          `オフライン記録 ${syncedCount} 件をサーバーへ自動同期しました！`
        )
      );
      triggerRefresh();
    } finally {
      setSyncing(false);
    }
  }, [offlineQueue, syncing, pushToast, triggerRefresh, lang]);

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
  const prodName = (id: string) => displayProductName(products.find((p) => p.id === id)?.name ?? id, lang);
  const tgName = (id: string) => displayTempGroupName(tempGroups.find((t) => t.id === id)?.name ?? id, lang);
  const lotStatusLabel = (status: string) => LOT_STATUS_I18N[status]?.[lang] ?? status;
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
      qcRejectionReason:
        stage === 'BG5' && Number(rejectedKg) > 0
          ? varianceReason || tx(lang, 'Hàng không đạt', '品質不合格')
          : undefined,
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
      pushToast(
        'warning',
        tx(
          lang,
          `Đang mất sóng: Đã lưu ${stage} vào hàng đợi thiết bị (sẽ tự đồng bộ khi có mạng).`,
          `オフライン中: ${stage} を端末キューに保存しました（復帰後に自動同期されます）。`
        )
      );
      return;
    }

    const res = await fetch('/api/epods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi ghi biên bản', '記録エラー'));
    if (data.warnings?.length) {
      pushToast('warning', data.warnings[0]);
    } else {
      pushToast(
        'success',
        tx(
          lang,
          `Đã ký bàn giao ${stage} lô ${selectedLot.lotCode} thành công!`,
          `ロット ${selectedLot.lotCode} の引渡 ${stage} を署名完了しました！`
        )
      );
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
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi tạo lô', 'ロット作成エラー'));
    pushToast(
      'success',
      tx(
        lang,
        `Đã tạo lô ${data.lot.lotCode} & sinh mã QR!`,
        `ロット ${data.lot.lotCode} を作成し QRコードを発行しました！`
      )
    );
    setQrLot(data.lot);
    triggerRefresh();
  };

  const handleCoolingAction = async (lotId: string, action: 'ENTER_COOLING' | 'EXIT_COOLING') => {
    const res = await fetch(`/api/lots/${lotId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return pushToast('error', tx(lang, 'Lỗi cập nhật phòng mát', '予冷室更新エラー'));
    pushToast(
      'success',
      action === 'ENTER_COOLING'
        ? tx(lang, 'Đã đưa lô vào phòng mát (FR-17)', 'ロットを予冷室へ入庫しました (FR-17)')
        : tx(lang, 'Đã xuất phòng mát', '予冷室から出庫しました')
    );
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
          label: `GPS Check-in ${tripId} (#${stopOrder})`,
        },
      ]);
      pushToast(
        'warning',
        tx(
          lang,
          'Đang mất sóng: Đã lưu Check-in GPS vào hàng đợi ngoại tuyến.',
          'オフライン中: GPSチェックインを端末キューに保存しました。'
        )
      );
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
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi cập nhật chuyến', '配車便更新エラー'));
    pushToast(
      'success',
      tx(lang, `Đã cập nhật chuyến ${data.trip.code}`, `配車便 ${data.trip.code} を更新しました`)
    );
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
    if (!res.ok) return pushToast('error', tx(lang, 'Lỗi xác nhận HTX', 'HTX確認エラー'));
    pushToast(
      'success',
      tx(
        lang,
        'HTX đã xác nhận sản lượng & khai báo nguồn gốc (FR-11, FR-13)',
        '農協 (HTX) の供給量確認・産地申告を送信しました (FR-11, FR-13)'
      )
    );
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
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi gửi giải trình', '弁明送信エラー'));
    pushToast(
      'success',
      tx(
        lang,
        'Đã gửi giải trình lên Quản lý QC Mitsui (FR-39)',
        'Mitsui QCマネージャーへ弁明書を提出しました (FR-39)'
      )
    );
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

  const roleShortLabel = (role: string) => {
    switch (role) {
      case 'NHA_CUNG_CAP':
        return tx(lang, 'HTX', '農協(HTX)');
      case 'NHAN_VIEN_SO_CHE':
        return tx(lang, 'Sơ chế', '選果・予冷');
      case 'NHAN_VIEN_KHO':
        return tx(lang, 'Kho lạnh', '冷蔵倉庫');
      default:
        return tx(lang, 'Tài xế', 'ドライバー');
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Top Offline Mode Banner + Role Quick Switcher */}
      <div
        className={`rounded-2xl border-2 p-4 shadow-sm flex flex-col gap-3 ${
          isOffline ? 'border-rose-400 bg-rose-50' : 'border-emerald-300 bg-emerald-50/70'
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
                {isOffline
                  ? tx(lang, 'CHẾ ĐỘ MẤT SÓNG (OFFLINE 24H)', 'オフラインモード (24時間保持)')
                  : tx(lang, 'ĐANG TRỰC TUYẾN', 'オンライン接続中')}
              </div>
              <div className="text-xs text-slate-600">
                {currentOrg ? displayOrgName(currentOrg.name, lang) : ''} ·{' '}
                {currentUser ? displayUserName(currentUser.name, lang) : ''}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsOffline((v) => !v)}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs ${
              isOffline ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {isOffline
              ? tx(lang, 'Bật lại mạng (Tự đồng bộ)', 'オンライン復帰（自動同期）')
              : tx(lang, 'Giả lập mất sóng (FR-33)', 'オフライン切替 (FR-33)')}
          </button>
        </div>

        {offlineQueue.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-300 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-amber-800">
              <span>
                {tx(
                  lang,
                  `Hàng đợi ngoại tuyến: ${offlineQueue.length} bản ghi`,
                  `オフライン待機キュー: ${offlineQueue.length} 件`
                )}
              </span>
              {!isOffline && (
                <button
                  onClick={flushOfflineQueue}
                  className="inline-flex items-center gap-1 text-emerald-700 underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> {tx(lang, 'Đồng bộ ngay', '今すぐ同期')}
                </button>
              )}
            </div>
            {offlineQueue.map((q) => (
              <div key={q.idempotencyKey} className="text-xs text-slate-600">
                • {q.label} ({tx(lang, 'ghi lúc', '記録時刻')} {formatTime(q.recordedAt, lang)})
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
              {roleShortLabel(u.role)} ({displayOrgName(u.orgName, lang).split(' ')[0]})
            </button>
          ))}
        </div>
      </div>

      {/* 1. Handover ePOD BG1-BG5 (<=5 steps, big touch targets NFR-10) */}
      <Card
        title={tx(lang, 'Bàn giao điện tử ePOD (Tối đa 5 bước · NFR-10)', '電子引渡署名 ePOD（最大5ステップ · NFR-10）')}
        subtitle={tx(
          lang,
          'Chọn lô → Chọn điểm BG1–BG5 → Nhập kg & nhiệt độ → Xác nhận',
          'ロット選択 → 引渡ポイント BG1–BG5 → 重量・温度入力 → 確定'
        )}
      >
        <form onSubmit={handleSubmitEpod} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {tx(lang, '1. Chọn / Quét lô hàng', '1. ロット選択 / QRスキャン')}
            </label>
            <select
              value={selectedLot?.id ?? ''}
              onChange={(e) => setSelectedLotId(e.target.value)}
              className="w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold"
            >
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lotCode} · {prodName(l.productId)} · {formatNum(l.currentKg, lang)} kg (
                  {lotStatusLabel(l.status)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {tx(lang, '2. Điểm bàn giao (BG1–BG5)', '2. 引渡ポイント (BG1–BG5)')}
            </label>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tx(lang, '3. Khối lượng thực (kg)', '3. 実測重量 (kg)')}
              </label>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {tx(lang, '4. Nhiệt độ đo (°C)', '4. 測定温度 (°C)')}
              </label>
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
                {tx(lang, 'Chọn buồng kho nhập (FR-18)', '入庫先庫室の選択 (FR-18)')}
              </label>
              <select
                value={chamberId}
                onChange={(e) => setChamberId(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-slate-300 px-3 text-sm font-medium"
              >
                {warehouseChambers.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {displayPlace(ch.name, lang)} ({tgName(ch.tempGroupId)})
                  </option>
                ))}
              </select>
              {wrongTempChamberWarning && (
                <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {tx(
                    lang,
                    'CẢNH BÁO FR-18 / BR-05: Buồng này KHÁC nhóm nhiệt của lô hàng!',
                    '警告 FR-18 / BR-05: この庫室はロットの指定温度帯と異なります！'
                  )}
                </div>
              )}
            </div>
          )}

          {stage === 'BG5' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tx(lang, 'Kg Đạt', '合格重量 (kg)')}
                </label>
                <input
                  type="number"
                  value={acceptedKg}
                  onChange={(e) => setAcceptedKg(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {tx(lang, 'Kg Không đạt', '不合格重量 (kg)')}
                </label>
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
              {tx(
                lang,
                'Ghi chú / Lý do (bắt buộc nếu lệch >2% hoặc ngoài dải nhiệt)',
                '備考・理由（2%超の重量差異または温度逸脱時は必須）'
              )}
            </label>
            <input
              type="text"
              value={varianceReason}
              onChange={(e) => setVarianceReason(e.target.value)}
              placeholder={tx(lang, 'Nhập lý do nếu có chênh lệch...', '差異がある場合は理由を入力...')}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full min-h-[52px] rounded-xl bg-emerald-600 text-white text-base font-bold hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />{' '}
            {tx(lang, `5. Xác nhận điện tử ePOD ${stage}`, `5. 電子署名 ePOD ${stage} を確定`)}
          </button>
        </form>
      </Card>

      {/* 2. Role-Adaptive Task Cards */}
      {currentUser?.role === 'NHA_CUNG_CAP' && (
        <Card
          title={tx(
            lang,
            'Kế hoạch thu hoạch & Khai báo nguồn gốc HTX (FR-11, FR-13)',
            '収穫計画・農協(HTX)産地申告 (FR-11, FR-13)'
          )}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={originArea}
                onChange={(e) => setOriginArea(e.target.value)}
                placeholder={tx(lang, 'Vùng trồng', '生産地')}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={originCert}
                onChange={(e) => setOriginCert(e.target.value)}
                placeholder={tx(lang, 'Chứng nhận VietGAP', 'VietGAP認証番号')}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            {plans.flatMap((p) =>
              p.allocations.map((a) => (
                <div key={a.id} className="p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between font-bold">
                    <span>
                      {prodName(a.productId)} ({p.planDate})
                    </span>
                    <AllocConfirmBadge status={a.confirmationStatus} />
                  </div>
                  <div>
                    {tx(lang, 'Yêu cầu thu hoạch:', '必要収穫数量:')}{' '}
                    <strong>{formatNum(a.requiredRawKg, lang)} kg</strong>
                  </div>
                  <button
                    onClick={() => handleHtxConfirm(p.id, a.id, a.requiredRawKg)}
                    className="w-full min-h-[42px] rounded-xl bg-emerald-600 text-white font-bold"
                  >
                    {tx(
                      lang,
                      `Xác nhận đủ ${a.requiredRawKg} kg & Gửi nguồn gốc`,
                      `${a.requiredRawKg} kg 供給確定・産地情報を送信`
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {currentUser?.role === 'NHAN_VIEN_SO_CHE' && (
        <>
          <Card
            title={tx(
              lang,
              'Phân loại, Tạo lô mới & In tem QR (FR-15, FR-16)',
              '選果・新規ロット作成・QRラベル発行 (FR-15, FR-16)'
            )}
          >
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
                        {displayOrgName(o.name, lang)}
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
                      {displayProductName(p.name, lang)}
                    </option>
                  ))}
                </select>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    {tx(lang, 'Hàng thô BG1 (kg)', 'BG1 受入原重量 (kg)')}
                  </label>
                  <input
                    type="number"
                    value={sortRawKg}
                    onChange={(e) => setSortRawKg(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    {tx(lang, 'Kg Đạt (tạo lô)', '選果合格重量 (kg)')}
                  </label>
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
                placeholder={tx(lang, 'Lý do loại', '選果除外理由')}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 text-xs"
              />
              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <PackagePlus className="w-4 h-4" />{' '}
                {tx(lang, 'Tạo lô & Sinh tem QR', 'ロット作成・QRコード発行')}
              </button>
            </form>
          </Card>

          <Card
            title={tx(
              lang,
              'Phòng mát & In lại tem QR lô của cơ sở (FR-17)',
              '予冷室入庫・施設ロットQR再発行 (FR-17)'
            )}
          >
            <div className="space-y-2.5">
              {lots.slice(0, 5).map((l) => (
                <div
                  key={l.id}
                  className="p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-mono text-xs font-bold">{l.lotCode}</div>
                    <div className="text-xs text-slate-500">
                      {prodName(l.productId)} · {formatNum(l.currentKg, lang)} kg
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setQrLot(l)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold inline-flex items-center gap-1"
                    >
                      <QrCode className="w-3.5 h-3.5" /> {tx(lang, 'Tem QR', 'QRラベル')}
                    </button>
                    {l.status === 'DA_TAO' && (
                      <button
                        onClick={() => handleCoolingAction(l.id, 'ENTER_COOLING')}
                        className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Snowflake className="w-3.5 h-3.5" /> {tx(lang, 'Vào phòng mát', '予冷室入庫')}
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
        <Card title={tx(lang, 'Tồn kho ưu tiên xuất FEFO (FR-19, FR-20)', 'FEFO 優先出庫在庫 (FR-19, FR-20)')}>
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
                      {prodName(l.productId)} · {formatNum(l.currentKg, lang)} kg
                    </div>
                  </div>
                  {item.isWarning && (
                    <Badge tone="rose">
                      {tx(lang, `Lưu ${item.usagePct}%`, `保管 ${item.usagePct}%`)}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {currentUser?.role === 'TAI_XE' && (
        <Card title={tx(lang, 'Lệnh chuyến & Check-in GPS (FR-24, NFR-09)', '配車指示・GPSチェックイン (FR-24, NFR-09)')}>
          <div className="space-y-3">
            {trips.map((t) => (
              <div key={t.id} className="p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-600" /> {t.code}
                  </span>
                  <TripStatusBadge status={t.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {t.status === 'MOI_TAO' && (
                    <button
                      onClick={() => handleTripAction(t.id, 'START')}
                      className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                    >
                      {tx(lang, 'Nhận lệnh & Bắt đầu chạy', '指示受領・運行開始')}
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
                      {s.actualCheckInTime
                        ? tx(
                            lang,
                            `Đã check-in: ${s.locationName}`,
                            `チェックイン済: ${displayPlace(s.locationName, lang)}`
                          )
                        : tx(
                            lang,
                            `Check-in GPS: ${s.locationName}`,
                            `GPSチェックイン: ${displayPlace(s.locationName, lang)}`
                          )}
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
        <Card
          title={tx(
            lang,
            'Khiếu nại đề xuất liên quan (Giải trình trong 48h — FR-39)',
            '関連クレーム（48時間以内に弁明提出 — FR-39）'
          )}
        >
          <div className="space-y-3">
            {claims
              .filter((c) => c.status !== 'DA_PHAN_QUYET')
              .map((c) => (
                <div key={c.id} className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2 text-xs">
                  <div className="font-bold text-amber-900">
                    {c.code} · {displayOperationalText(c.systemSuggestedStage, lang)}
                  </div>
                  <p className="text-amber-800">{displayOperationalText(c.systemSuggestionDetail, lang)}</p>
                  {c.partnerExplanation ? (
                    <div className="text-emerald-700 font-semibold">
                      {tx(lang, 'Đã gửi giải trình:', '提出済弁明:')}{' '}
                      {displayOperationalText(c.partnerExplanation.content, lang)}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={explainText}
                        onChange={(e) => setExplainText(e.target.value)}
                        placeholder={tx(lang, 'Nhập giải trình của đối tác...', 'パートナー弁明を入力...')}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <button
                        onClick={() => handleSubmitExplanation(c.id)}
                        className="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold"
                      >
                        {tx(lang, 'Gửi giải trình', '弁明を送信')}
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
        <Card title={tx(lang, 'Cảnh báo nhiệt độ của đơn vị', '自社の温度アラート')}>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((a) => (
              <div key={a.id} className="p-3 rounded-xl border border-rose-200 bg-rose-50/40 text-xs flex justify-between">
                <div>
                  <strong>{displayPlace(a.stage, lang)}</strong> · {a.durationMinutes}{' '}
                  {tx(lang, 'phút', '分')}
                </div>
                <Badge tone={a.acknowledgedAt ? 'emerald' : 'rose'}>
                  {a.acknowledgedAt ? tx(lang, 'Đã xử lý', '対応済') : tx(lang, 'Chưa xác nhận', '未確認')}
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
          productName={products.find((p) => p.id === qrLot.productId)?.name ?? qrLot.productId}
          packingDate={qrLot.packingDate}
          weightKg={qrLot.currentKg}
        />
      )}
    </div>
  );
}
