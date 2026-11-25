'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FileEdit, GitFork, Lock, QrCode, Search, Snowflake } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, LotStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { QrCodeModal } from '@/components/ui/QrCodeModal';
import { useCct } from '@/components/layout/CctContext';
import { LOT_STATUS_ORDER } from '@/domain/lot-lifecycle';
import { LotDossier } from '@/domain/claim';
import { EpodAdjustment, Lot } from '@/types/lot-epod';
import { Organization } from '@/types/common';
import { Product, TempGroup } from '@/types/catalog';

export function LotDossierPanel({ initialLotId }: { initialLotId?: string }) {
  const { refreshTick, pushToast, triggerRefresh } = useCct();
  const [lots, setLots] = useState<Lot[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tempGroups, setTempGroups] = useState<TempGroup[]>([]);
  const [selectedLotId, setSelectedLotId] = useState(initialLotId || '');
  const [dossier, setDossier] = useState<LotDossier | null>(null);
  const [adjustments, setAdjustments] = useState<EpodAdjustment[]>([]);
  const [search, setSearch] = useState('');
  const [qrOpen, setQrOpen] = useState(false);

  // Split lot modal
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitKgA, setSplitKgA] = useState(0);
  const [splitKgB, setSplitKgB] = useState(0);

  // Adjustment modal (FR-34)
  const [adjEpodId, setAdjEpodId] = useState<string | null>(null);
  const [adjKg, setAdjKg] = useState('');
  const [adjTemp, setAdjTemp] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const loadList = useCallback(async () => {
    const [lRes, cRes] = await Promise.all([
      fetch('/api/lots', { cache: 'no-store' }),
      fetch('/api/catalog', { cache: 'no-store' }),
    ]);
    if (lRes.ok) {
      const lData = await lRes.json();
      const allLots: Lot[] = lData.lots ?? [];
      setLots(allLots);
      if (!selectedLotId && allLots.length) {
        const preferred = allLots.find((l) => l.id === 'LOT-03') ?? allLots[0];
        setSelectedLotId(preferred.id);
      }
    }
    if (cRes.ok) {
      const cat = await cRes.json();
      setOrgs(cat.organizations ?? []);
      setProducts(cat.products ?? []);
      setTempGroups(cat.tempGroups ?? []);
    }
  }, [selectedLotId]);

  const loadDossier = useCallback(async (lotId: string) => {
    if (!lotId) return;
    const res = await fetch(`/api/lots/${lotId}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setDossier(data.dossier);
      setAdjustments(data.adjustments ?? []);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList, refreshTick]);

  useEffect(() => {
    if (selectedLotId) loadDossier(selectedLotId);
  }, [selectedLotId, loadDossier, refreshTick]);

  const orgName = (id?: string) => orgs.find((o) => o.id === id)?.name ?? id ?? '—';
  const prod = (id?: string) => products.find((p) => p.id === id);
  const tg = (id?: string) => tempGroups.find((t) => t.id === id);

  const filteredLots = lots.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      l.lotCode.toLowerCase().includes(q) ||
      (prod(l.productId)?.name.toLowerCase().includes(q) ?? false) ||
      l.growingArea.toLowerCase().includes(q)
    );
  });

  const handleOpenSplit = () => {
    if (!dossier) return;
    const half = Math.floor(dossier.lot.currentKg / 2);
    setSplitKgA(half);
    setSplitKgB(dossier.lot.currentKg - half);
    setSplitOpen(true);
  };

  const handleSplitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dossier) return;
    const res = await fetch(`/api/lots/${dossier.lot.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SPLIT_LOT',
        splits: [
          { weightKg: Number(splitKgA), deliveryPointName: 'Điểm nhận A' },
          { weightKg: Number(splitKgB), deliveryPointName: 'Điểm nhận B' },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi tách lô');
    pushToast('success', 'Đã tách lô thành 2 lô con giữ nguyên lịch sử gốc (BR-06)');
    setSplitOpen(false);
    triggerRefresh();
  };

  const handleAdjSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjEpodId) return;
    const res = await fetch(`/api/epods/${adjEpodId}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adjustedActualKg: Number(adjKg),
        adjustedTempC: Number(adjTemp),
        reason: adjReason,
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi tạo biên bản điều chỉnh');
    pushToast('success', 'Đã tạo Biên bản điều chỉnh liên kết ePOD gốc (FR-34, NFR-06)');
    setAdjEpodId(null);
    setAdjReason('');
    triggerRefresh();
  };

  const chartData =
    dossier?.tempCompliance.points.map((p) => ({
      time: new Date(p.timestamp).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      }),
      tempC: p.tempC,
      stage: p.locationLabel,
    })) ?? [];

  const activeTg = tg(dossier?.lot.tempGroupId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Hồ sơ Lô hàng toàn diện & Chuỗi ePOD (M4, M8)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Theo dõi vòng đời 8 trạng thái, đường nhiệt độ liên tục BG1–BG5, tách lô con và biên bản điều chỉnh bất biến.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Lot Selector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã lô, mặt hàng, vùng trồng..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {filteredLots.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedLotId(l.id)}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  selectedLotId === l.id
                    ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900">{l.lotCode}</span>
                  <LotStatusBadge status={l.status} />
                </div>
                <div className="text-xs font-medium text-slate-700 mt-1">
                  {prod(l.productId)?.name} · {l.currentKg.toLocaleString('vi-VN')} kg
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {l.parentLotId && <Badge tone="purple">Lô con tách</Badge>}
                  {l.childLotIds.length > 0 && <Badge tone="purple">Đã tách ({l.childLotIds.length})</Badge>}
                  {(l.hasTempAlert || l.hasDataGap) && <Badge tone="rose">Có cảnh báo</Badge>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Dossier View */}
        <div className="lg:col-span-8 space-y-5">
          {dossier ? (
            <>
              <Card
                title={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{dossier.lot.lotCode}</span>
                    <LotStatusBadge status={dossier.lot.status} />
                    <Badge tone={dossier.lot.tempGroupId === 'TG-LANH' ? 'blue' : 'amber'}>
                      <Snowflake className="w-3 h-3" /> {activeTg?.name}
                    </Badge>
                  </div>
                }
                subtitle={`${prod(dossier.lot.productId)?.name} · Nguồn: ${orgName(dossier.lot.supplierOrgId)} (${dossier.lot.growingArea}) · Bên giữ hiện tại: ${orgName(dossier.lot.currentCustodianOrgId)}`}
                action={
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setQrOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Xem / In QR
                    </button>
                    {dossier.lot.currentKg > 1 && dossier.lot.childLotIds.length === 0 && (
                      <button
                        onClick={handleOpenSplit}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                      >
                        <GitFork className="w-3.5 h-3.5" /> Tách lô con (BR-06)
                      </button>
                    )}
                  </div>
                }
              >
                {/* 8-State Lifecycle Stepper */}
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mb-4">
                  {LOT_STATUS_ORDER.map((st) => {
                    const currentIdx = LOT_STATUS_ORDER.indexOf(dossier.lot.status);
                    const idx = LOT_STATUS_ORDER.indexOf(st);
                    const reached = idx <= currentIdx;
                    return (
                      <div
                        key={st}
                        className={`text-center py-1.5 px-1 rounded-lg text-[10px] font-semibold border ${
                          st === dossier.lot.status
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : reached
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}
                      >
                        {st}
                      </div>
                    );
                  })}
                </div>

                {dossier.lot.parentLotId && (
                  <div className="text-xs bg-purple-50 border border-purple-200 text-purple-800 rounded-xl p-2.5 mb-3">
                    Lô con tách từ lô gốc ID <strong>{dossier.lot.parentLotId}</strong> — kế thừa toàn bộ biên bản & đường nhiệt độ trước khi tách.
                  </div>
                )}

                <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <strong>Đánh giá tự động BR-10:</strong> {dossier.suggestion.detail}
                </div>
              </Card>

              {/* Continuous Temperature Chart (BG1 -> BG5) */}
              <Card
                title="Đường nhiệt độ liên tục BG1 → BG5 (FR-27)"
                subtitle={`Tuân thủ dải: ${dossier.tempCompliance.inRangePct}% (${dossier.tempCompliance.inRangeMinutes}/${dossier.tempCompliance.totalMinutes} phút)`}
              >
                {chartData.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit="°C" />
                        <Tooltip />
                        {activeTg && (
                          <ReferenceArea
                            y1={activeTg.minTempC}
                            y2={activeTg.maxTempC}
                            fill="#10b981"
                            fillOpacity={0.12}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="tempC"
                          name="Nhiệt độ (°C)"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    Chưa có dữ liệu logger gắn với các chặng của lô này.
                  </p>
                )}
              </Card>

              {/* 5 ePOD Handover Cards */}
              <Card
                title="Chuỗi biên bản bàn giao điện tử ePOD (BG1–BG5)"
                subtitle="Bản ghi gốc bất biến (NFR-06). Sai sót chỉ xử lý bằng Biên bản điều chỉnh có xác nhận 2 bên (FR-34)."
              >
                <div className="space-y-3">
                  {dossier.epods.map((ep) => (
                    <div
                      key={ep.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-xs font-bold">
                            {ep.stage}
                          </span>
                          <span className="text-xs font-semibold text-slate-900">
                            {orgName(ep.senderOrgId)} → {orgName(ep.receiverOrgId)}
                          </span>
                          {ep.lotId !== dossier.lot.id && (
                            <Badge tone="purple">Kế thừa từ lô gốc</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone="slate">
                            <Lock className="w-3 h-3" /> Bất biến
                          </Badge>
                          <button
                            onClick={() => {
                              setAdjEpodId(ep.id);
                              setAdjKg(String(ep.effective.actualKg));
                              setAdjTemp(String(ep.effective.measuredTempC));
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium hover:bg-slate-100"
                          >
                            <FileEdit className="w-3 h-3" /> Điều chỉnh (FR-34)
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400">Khối lượng:</span>{' '}
                          <strong>{ep.effective.actualKg.toLocaleString('vi-VN')} kg</strong>
                          {ep.variancePct !== undefined && (
                            <span
                              className={`ml-1 ${
                                Math.abs(ep.variancePct) > 2 ? 'text-rose-600 font-bold' : 'text-slate-500'
                              }`}
                            >
                              ({ep.variancePct}%)
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400">Nhiệt độ BG:</span>{' '}
                          <strong className={ep.tempOutOfRange ? 'text-rose-600' : 'text-emerald-700'}>
                            {ep.effective.measuredTempC}°C
                          </strong>
                        </div>
                        {ep.stage === 'BG5' && (
                          <div>
                            <span className="text-slate-400">Đạt / Loại:</span>{' '}
                            <strong>
                              {ep.effective.acceptedKg ?? ep.effective.actualKg} / {ep.effective.rejectedKg ?? 0} kg
                            </strong>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400">Thời điểm ghi:</span>{' '}
                          <span>{new Date(ep.recordedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                        </div>
                      </div>

                      {ep.varianceReason && (
                        <div className="text-xs text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5">
                          Lý do chênh lệch: {ep.varianceReason}
                        </div>
                      )}
                      {ep.effective.adjustmentCount > 0 && (
                        <div className="text-xs text-purple-800 bg-purple-50 rounded-lg px-2.5 py-1.5">
                          Đã áp dụng {ep.effective.adjustmentCount} biên bản điều chỉnh: {ep.effective.latestAdjustmentReason}
                        </div>
                      )}
                    </div>
                  ))}
                  {adjustments.length > 0 && (
                    <div className="text-xs text-slate-500">
                      Tổng cộng {adjustments.length} biên bản điều chỉnh được lưu vết cho lô này.
                    </div>
                  )}
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <p className="text-sm text-slate-500">Chọn một lô hàng ở danh sách bên trái để xem hồ sơ.</p>
            </Card>
          )}
        </div>
      </div>

      {/* QR Print Modal */}
      {dossier && (
        <QrCodeModal
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          lotCode={dossier.lot.lotCode}
          qrToken={dossier.lot.qrToken}
          productName={prod(dossier.lot.productId)?.name ?? ''}
          packingDate={dossier.lot.packingDate}
          tempRangeLabel={activeTg?.name}
          weightKg={dossier.lot.currentKg}
        />
      )}

      {/* Split Lot Modal */}
      <Modal
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        title={`Tách lô ${dossier?.lot.lotCode ?? ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSplitSubmit} className="space-y-3">
          <p className="text-xs text-slate-600">
            Khối lượng hiện tại: <strong>{dossier?.lot.currentKg} kg</strong>. Lô con sẽ giữ liên kết{' '}
            <code>parentLotId</code> và toàn bộ lịch sử trước khi tách (BR-06).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Lô con A (kg)</label>
              <input
                type="number"
                value={splitKgA}
                onChange={(e) => setSplitKgA(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Lô con B (kg)</label>
              <input
                type="number"
                value={splitKgB}
                onChange={(e) => setSplitKgB(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSplitOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              Xác nhận tách lô
            </button>
          </div>
        </form>
      </Modal>

      {/* ePOD Adjustment Modal */}
      <Modal
        open={Boolean(adjEpodId)}
        onClose={() => setAdjEpodId(null)}
        title="Tạo Biên bản điều chỉnh ePOD (FR-34, NFR-06)"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAdjSubmit} className="space-y-3">
          <p className="text-xs text-slate-500">
            Bản ghi gốc không thể bị sửa. Hệ thống sẽ lưu thêm biên bản điều chỉnh có xác nhận 2 bên và nhật ký kiểm toán.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Khối lượng mới (kg)</label>
              <input
                type="number"
                step="0.1"
                value={adjKg}
                onChange={(e) => setAdjKg(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nhiệt độ mới (°C)</label>
              <input
                type="number"
                step="0.1"
                value={adjTemp}
                onChange={(e) => setAdjTemp(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Lý do điều chỉnh</label>
            <textarea
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              rows={3}
              placeholder="VD: Cân lại phát hiện sai số đầu cân tại điểm bàn giao..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdjEpodId(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
            >
              Đóng
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              Lưu biên bản điều chỉnh
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
