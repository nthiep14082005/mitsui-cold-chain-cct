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
import {
  displayOperationalText,
  displayOrgName,
  displayPlace,
  displayProductName,
  displayTempGroupName,
  formatDateTime,
  formatNum,
  formatTime,
  LOT_STATUS_I18N,
  tx,
} from '@/lib/i18n';
import { LOT_STATUS_ORDER } from '@/domain/lot-lifecycle';
import { LotDossier } from '@/domain/claim';
import { EpodAdjustment, Lot } from '@/types/lot-epod';
import { Organization } from '@/types/common';
import { Product, TempGroup } from '@/types/catalog';

export function LotDossierPanel({ initialLotId }: { initialLotId?: string }) {
  const { refreshTick, pushToast, triggerRefresh, lang } = useCct();
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

  const orgName = (id?: string) =>
    id ? displayOrgName(orgs.find((o) => o.id === id)?.name ?? id, lang) : '—';
  const prod = (id?: string) => products.find((p) => p.id === id);
  const tg = (id?: string) => tempGroups.find((t) => t.id === id);

  const filteredLots = lots.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const rawName = prod(l.productId)?.name ?? '';
    const jaName = displayProductName(rawName, 'ja');
    return (
      l.lotCode.toLowerCase().includes(q) ||
      rawName.toLowerCase().includes(q) ||
      jaName.toLowerCase().includes(q) ||
      l.growingArea.toLowerCase().includes(q) ||
      displayPlace(l.growingArea, 'ja').toLowerCase().includes(q)
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
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi tách lô', 'ロット分割エラー'));
    pushToast(
      'success',
      tx(
        lang,
        'Đã tách lô thành 2 lô con giữ nguyên lịch sử gốc (BR-06)',
        '元の履歴を継承した2つの子ロットへ分割しました (BR-06)'
      )
    );
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
    if (!res.ok)
      return pushToast(
        'error',
        data.error || tx(lang, 'Lỗi tạo biên bản điều chỉnh', '訂正記録作成エラー')
      );
    pushToast(
      'success',
      tx(
        lang,
        'Đã tạo Biên bản điều chỉnh liên kết ePOD gốc (FR-34, NFR-06)',
        '原ePODに紐付く訂正記録を作成しました (FR-34, NFR-06)'
      )
    );
    setAdjEpodId(null);
    setAdjReason('');
    triggerRefresh();
  };

  const chartData =
    dossier?.tempCompliance.points.map((p) => ({
      time: formatTime(p.timestamp, lang),
      tempC: p.tempC,
      stage: displayPlace(p.locationLabel, lang),
    })) ?? [];

  const activeTg = tg(dossier?.lot.tempGroupId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          {tx(
            lang,
            'Hồ sơ Lô hàng toàn diện & Chuỗi ePOD (M4, M8)',
            '統合ロット台帳・ePOD チェーン履歴 (M4, M8)'
          )}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          {tx(
            lang,
            'Theo dõi vòng đời 8 trạng thái, đường nhiệt độ liên tục BG1–BG5, tách lô con và biên bản điều chỉnh bất biến.',
            '8段階ライフサイクル、BG1〜BG5連続温度グラフ、子ロット分割、および改変不可のePOD訂正記録を管理。'
          )}
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
              placeholder={tx(
                lang,
                'Tìm mã lô, mặt hàng, vùng trồng...',
                'ロット番号・品目・産地で検索...'
              )}
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
                  {displayProductName(prod(l.productId)?.name ?? l.productId, lang)} ·{' '}
                  {formatNum(l.currentKg, lang)} kg
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {l.parentLotId && (
                    <Badge tone="purple">{tx(lang, 'Lô con tách', '分割子ロット')}</Badge>
                  )}
                  {l.childLotIds.length > 0 && (
                    <Badge tone="purple">
                      {tx(lang, `Đã tách (${l.childLotIds.length})`, `分割済 (${l.childLotIds.length})`)}
                    </Badge>
                  )}
                  {(l.hasTempAlert || l.hasDataGap) && (
                    <Badge tone="rose">{tx(lang, 'Có cảnh báo', 'アラート有')}</Badge>
                  )}
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
                      <Snowflake className="w-3 h-3" />{' '}
                      {displayTempGroupName(activeTg?.name ?? dossier.lot.tempGroupId, lang)}
                    </Badge>
                  </div>
                }
                subtitle={`${displayProductName(prod(dossier.lot.productId)?.name ?? dossier.lot.productId, lang)} · ${tx(lang, 'Nguồn:', '産地:')} ${orgName(dossier.lot.supplierOrgId)} (${displayPlace(dossier.lot.growingArea, lang)}) · ${tx(lang, 'Bên giữ hiện tại:', '現在保管者:')} ${orgName(dossier.lot.currentCustodianOrgId)}`}
                action={
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setQrOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                    >
                      <QrCode className="w-3.5 h-3.5" /> {tx(lang, 'Xem / In QR', 'QR表示・印刷')}
                    </button>
                    {dossier.lot.currentKg > 1 && dossier.lot.childLotIds.length === 0 && (
                      <button
                        onClick={handleOpenSplit}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                      >
                        <GitFork className="w-3.5 h-3.5" />{' '}
                        {tx(lang, 'Tách lô con (BR-06)', '子ロット分割 (BR-06)')}
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
                        {LOT_STATUS_I18N[st]?.[lang] ?? st}
                      </div>
                    );
                  })}
                </div>

                {dossier.lot.parentLotId && (
                  <div className="text-xs bg-purple-50 border border-purple-200 text-purple-800 rounded-xl p-2.5 mb-3">
                    {tx(
                      lang,
                      `Lô con tách từ lô gốc ID ${dossier.lot.parentLotId} — kế thừa toàn bộ biên bản & đường nhiệt độ trước khi tách.`,
                      `親ロット ID ${dossier.lot.parentLotId} から分割された子ロット — 分割前の全記録・温度ログを継承。`
                    )}
                  </div>
                )}

                <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <strong>{tx(lang, 'Đánh giá tự động BR-10:', 'BR-10 自動診断結果:')}</strong>{' '}
                  {displayOperationalText(dossier.suggestion.detail, lang)}
                </div>
              </Card>

              {/* Continuous Temperature Chart (BG1 -> BG5) */}
              <Card
                title={tx(lang, 'Đường nhiệt độ liên tục BG1 → BG5 (FR-27)', '連続温度推移グラフ BG1 → BG5 (FR-27)')}
                subtitle={tx(
                  lang,
                  `Tuân thủ dải: ${dossier.tempCompliance.inRangePct}% (${dossier.tempCompliance.inRangeMinutes}/${dossier.tempCompliance.totalMinutes} phút)`,
                  `温度帯遵守率: ${dossier.tempCompliance.inRangePct}% (${dossier.tempCompliance.inRangeMinutes}/${dossier.tempCompliance.totalMinutes} 分)`
                )}
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
                          name={tx(lang, 'Nhiệt độ (°C)', '温度 (°C)')}
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    {tx(
                      lang,
                      'Chưa có dữ liệu logger gắn với các chặng của lô này.',
                      'このロットの各区間に紐付くLoggerデータがまだありません。'
                    )}
                  </p>
                )}
              </Card>

              {/* 5 ePOD Handover Cards */}
              <Card
                title={tx(lang, 'Chuỗi biên bản bàn giao điện tử ePOD (BG1–BG5)', '電子引渡記録チェーン ePOD (BG1–BG5)')}
                subtitle={tx(
                  lang,
                  'Bản ghi gốc bất biến (NFR-06). Sai sót chỉ xử lý bằng Biên bản điều chỉnh có xác nhận 2 bên (FR-34).',
                  '原記録は改変不可 (NFR-06)。修正が必要な場合は双方合意の訂正記録 (FR-34) を追加します。'
                )}
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
                            <Badge tone="purple">
                              {tx(lang, 'Kế thừa từ lô gốc', '親ロットから継承')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone="slate">
                            <Lock className="w-3 h-3" /> {tx(lang, 'Bất biến', '改変不可')}
                          </Badge>
                          <button
                            onClick={() => {
                              setAdjEpodId(ep.id);
                              setAdjKg(String(ep.effective.actualKg));
                              setAdjTemp(String(ep.effective.measuredTempC));
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium hover:bg-slate-100"
                          >
                            <FileEdit className="w-3 h-3" />{' '}
                            {tx(lang, 'Điều chỉnh (FR-34)', '訂正記録 (FR-34)')}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400">{tx(lang, 'Khối lượng:', '重量:')}</span>{' '}
                          <strong>{formatNum(ep.effective.actualKg, lang)} kg</strong>
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
                          <span className="text-slate-400">{tx(lang, 'Nhiệt độ BG:', '引渡温度:')}</span>{' '}
                          <strong className={ep.tempOutOfRange ? 'text-rose-600' : 'text-emerald-700'}>
                            {ep.effective.measuredTempC}°C
                          </strong>
                        </div>
                        {ep.stage === 'BG5' && (
                          <div>
                            <span className="text-slate-400">{tx(lang, 'Đạt / Loại:', '合格 / 不合格:')}</span>{' '}
                            <strong>
                              {formatNum(ep.effective.acceptedKg ?? ep.effective.actualKg, lang)} /{' '}
                              {formatNum(ep.effective.rejectedKg ?? 0, lang)} kg
                            </strong>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400">{tx(lang, 'Thời điểm ghi:', '記録日時:')}</span>{' '}
                          <span>{formatDateTime(ep.recordedAt, lang)}</span>
                        </div>
                      </div>

                      {ep.varianceReason && (
                        <div className="text-xs text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5">
                          {tx(lang, 'Lý do chênh lệch:', '差異理由:')}{' '}
                          {displayOperationalText(ep.varianceReason, lang)}
                        </div>
                      )}
                      {ep.effective.adjustmentCount > 0 && (
                        <div className="text-xs text-purple-800 bg-purple-50 rounded-lg px-2.5 py-1.5">
                          {tx(
                            lang,
                            `Đã áp dụng ${ep.effective.adjustmentCount} biên bản điều chỉnh:`,
                            `${ep.effective.adjustmentCount} 件の訂正記録を適用済:`
                          )}{' '}
                          {displayOperationalText(ep.effective.latestAdjustmentReason ?? '', lang)}
                        </div>
                      )}
                    </div>
                  ))}
                  {adjustments.length > 0 && (
                    <div className="text-xs text-slate-500">
                      {tx(
                        lang,
                        `Tổng cộng ${adjustments.length} biên bản điều chỉnh được lưu vết cho lô này.`,
                        `このロットには合計 ${adjustments.length} 件の訂正記録が保存されています。`
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <p className="text-sm text-slate-500">
                {tx(
                  lang,
                  'Chọn một lô hàng ở danh sách bên trái để xem hồ sơ.',
                  '左側のリストからロットを選択すると詳細が表示されます。'
                )}
              </p>
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
        title={tx(lang, `Tách lô ${dossier?.lot.lotCode ?? ''}`, `ロット分割 ${dossier?.lot.lotCode ?? ''}`)}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSplitSubmit} className="space-y-3">
          <p className="text-xs text-slate-600">
            {tx(lang, 'Khối lượng hiện tại:', '現在重量:')}{' '}
            <strong>{dossier?.lot.currentKg} kg</strong>.{' '}
            {tx(
              lang,
              'Lô con sẽ giữ liên kết parentLotId và toàn bộ lịch sử trước khi tách (BR-06).',
              '子ロットは parentLotId リンクと分割前の全履歴を継承します (BR-06)。'
            )}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {tx(lang, 'Lô con A (kg)', '子ロット A (kg)')}
              </label>
              <input
                type="number"
                value={splitKgA}
                onChange={(e) => setSplitKgA(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {tx(lang, 'Lô con B (kg)', '子ロット B (kg)')}
              </label>
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
              {tx(lang, 'Hủy', 'キャンセル')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              {tx(lang, 'Xác nhận tách lô', '分割を確定')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ePOD Adjustment Modal */}
      <Modal
        open={Boolean(adjEpodId)}
        onClose={() => setAdjEpodId(null)}
        title={tx(lang, 'Tạo Biên bản điều chỉnh ePOD (FR-34, NFR-06)', 'ePOD 訂正記録を作成 (FR-34, NFR-06)')}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAdjSubmit} className="space-y-3">
          <p className="text-xs text-slate-500">
            {tx(
              lang,
              'Bản ghi gốc không thể bị sửa. Hệ thống sẽ lưu thêm biên bản điều chỉnh có xác nhận 2 bên và nhật ký kiểm toán.',
              '原記録は変更できません。双方確認済の訂正記録と監査ログを新規追加します。'
            )}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {tx(lang, 'Khối lượng mới (kg)', '訂正後重量 (kg)')}
              </label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {tx(lang, 'Nhiệt độ mới (°C)', '訂正後温度 (°C)')}
              </label>
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
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {tx(lang, 'Lý do điều chỉnh', '訂正理由')}
            </label>
            <textarea
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              rows={3}
              placeholder={tx(
                lang,
                'VD: Cân lại phát hiện sai số đầu cân tại điểm bàn giao...',
                '例: 引渡地点での再計量により秤の誤差が判明したため...'
              )}
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
              {tx(lang, 'Đóng', '閉じる')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              {tx(lang, 'Lưu biên bản điều chỉnh', '訂正記録を保存')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
