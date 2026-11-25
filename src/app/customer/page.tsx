'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileWarning,
  PackageCheck,
  Plus,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useCct } from '@/components/layout/CctContext';
import {
  displayOperationalText,
  displayOrgName,
  displayPlace,
  displayProductName,
  displayUserName,
  formatNum,
  formatVnd,
  localizeKpiMetric,
  tx,
} from '@/lib/i18n';
import { Card, StatCard } from '@/components/ui/Card';
import {
  ClaimStatusBadge,
  LotStatusBadge,
  OrderStatusBadge,
  StatementStatusBadge,
} from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { FrameworkContract, Product } from '@/types/catalog';
import { DailyOrder } from '@/types/order-plan';
import { EpodRecord, Lot } from '@/types/lot-epod';
import { Claim, KpiDashboardData, MonthlyStatement } from '@/types/claim-billing-kpi';

export default function CustomerPortalPage() {
  const { currentUser, currentOrg, refreshTick, pushToast, triggerRefresh, switchUser, demoUsers, lang } =
    useCct();

  const [contract, setContract] = useState<FrameworkContract | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [epods, setEpods] = useState<EpodRecord[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [statements, setStatements] = useState<MonthlyStatement[]>([]);
  const [kpiData, setKpiData] = useState<KpiDashboardData | null>(null);

  // New Order Form
  const [deliveryDate, setDeliveryDate] = useState('2026-11-26');
  const [deliveryPointId, setDeliveryPointId] = useState('');
  const [timeSlot, setTimeSlot] = useState('06:00-08:00');
  const [productId, setProductId] = useState('');
  const [requestedKg, setRequestedKg] = useState(500);
  const [afterCutoffTest, setAfterCutoffTest] = useState(false);

  // BG5 Sign Modal
  const [bg5Lot, setBg5Lot] = useState<Lot | null>(null);
  const [bg5ActualKg, setBg5ActualKg] = useState(0);
  const [bg5TempC, setBg5TempC] = useState(2.8);
  const [bg5AcceptedKg, setBg5AcceptedKg] = useState(0);
  const [bg5RejectedKg, setBg5RejectedKg] = useState(0);
  const [bg5Reason, setBg5Reason] = useState('');

  // Claim Modal (FR-36)
  const [claimLot, setClaimLot] = useState<Lot | null>(null);
  const [claimKg, setClaimKg] = useState(0);
  const [claimDesc, setClaimDesc] = useState('');

  const loadData = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'KHACH_HANG') return;
    const [catRes, ordRes, lotRes, epRes, clmRes, bilRes, kpiRes] = await Promise.all([
      fetch('/api/catalog', { cache: 'no-store' }),
      fetch('/api/orders', { cache: 'no-store' }),
      fetch('/api/lots', { cache: 'no-store' }),
      fetch('/api/epods', { cache: 'no-store' }),
      fetch('/api/claims', { cache: 'no-store' }),
      fetch('/api/billing?month=2026-11', { cache: 'no-store' }),
      fetch('/api/kpi?month=2026-11', { cache: 'no-store' }),
    ]);

    if (catRes.ok) {
      const cat = await catRes.json();
      const fc: FrameworkContract | null = cat.frameworkContracts?.[0] ?? null;
      setContract(fc);
      const allProds: Product[] = cat.products ?? [];
      setProducts(allProds);
      if (fc) {
        if (!fc.deliveryPoints.some((d) => d.id === deliveryPointId) && fc.deliveryPoints[0]) {
          setDeliveryPointId(fc.deliveryPoints[0].id);
        }
        if (!fc.allowedProductIds.includes(productId) && fc.allowedProductIds[0]) {
          setProductId(fc.allowedProductIds[0]);
        }
      }
    }
    if (ordRes.ok) setOrders((await ordRes.json()).orders ?? []);
    if (lotRes.ok) setLots((await lotRes.json()).lots ?? []);
    if (epRes.ok) setEpods((await epRes.json()).epods ?? []);
    if (clmRes.ok) setClaims((await clmRes.json()).claims ?? []);
    if (bilRes.ok) setStatements((await bilRes.json()).statements ?? []);
    if (kpiRes.ok) setKpiData((await kpiRes.json()).kpiData ?? null);
  }, [currentUser, deliveryPointId, productId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTick]);

  const prodName = (id: string) => {
    const raw = products.find((p) => p.id === id)?.name ?? id;
    return displayProductName(raw, lang);
  };

  if (currentUser && currentUser.role !== 'KHACH_HANG') {
    const customerAccounts = demoUsers.filter((u) => u.role === 'KHACH_HANG');
    return (
      <AppShell channel="customer">
        <Card
          title={tx(lang, 'Kênh Web Khách hàng B2B (NFR-07)', 'B2B顧客Webポータル (NFR-07)')}
          subtitle={tx(
            lang,
            'Vui lòng chọn một tài khoản Khách hàng B2B để xem đơn hàng, tiến độ Take-or-Pay và bảng kê của riêng tổ chức đó.',
            '注文状況、Take-or-Pay 進捗、および自社の精算書を表示するには B2B顧客アカウントを選択してください。'
          )}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {customerAccounts.map((u) => (
              <button
                key={u.id}
                onClick={() => switchUser(u.id)}
                className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 text-left transition"
              >
                <div className="text-sm font-bold text-slate-900">
                  {displayOrgName(u.orgName, lang)}
                </div>
                <div className="text-xs text-slate-600 mt-1">{displayUserName(u.name, lang)}</div>
              </button>
            ))}
          </div>
        </Card>
      </AppShell>
    );
  }

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const simulatedSubmitTime = afterCutoffTest
      ? `${deliveryDate.slice(0, 8)}${String(Math.max(1, Number(deliveryDate.slice(8, 10)) - 1)).padStart(2, '0')}T15:30:00+07:00`
      : `${deliveryDate.slice(0, 8)}${String(Math.max(1, Number(deliveryDate.slice(8, 10)) - 1)).padStart(2, '0')}T10:30:00+07:00`;

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deliveryDate,
        deliveryPointId,
        timeSlot,
        items: [{ productId, requestedKg: Number(requestedKg), confirmedKg: 0 }],
        simulatedSubmitTime,
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi tạo đơn', '注文作成エラー'));
    pushToast(
      data.order.isAdHoc ? 'warning' : 'success',
      data.order.isAdHoc
        ? tx(
            lang,
            `Đơn ${data.order.code} gửi sau 14:00 D-1 → Trạng thái Phát sinh chờ Mitsui duyệt (BR-02)`,
            `注文 ${data.order.code} は D-1 14:00 締切後のため「締切後追加」となり Mitsui 承認待ちになります (BR-02)`
          )
        : tx(
            lang,
            `Đã gửi đơn ngày ${data.order.code} thành công!`,
            `日次注文 ${data.order.code} を送信しました！`
          )
    );
    triggerRefresh();
  };

  const handleSignBg5 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bg5Lot) return;
    const res = await fetch('/api/epods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'BG5',
        lotId: bg5Lot.id,
        actualKg: Number(bg5ActualKg),
        measuredTempC: Number(bg5TempC),
        acceptedKg: Number(bg5AcceptedKg),
        rejectedKg: Number(bg5RejectedKg),
        qcRejectionReason: bg5RejectedKg > 0 ? bg5Reason : undefined,
        varianceReason: bg5Reason || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi ký BG5', 'BG5署名エラー'));
    pushToast(
      'success',
      tx(
        lang,
        `Đã ký nhận ePOD BG5 cho lô ${bg5Lot.lotCode}`,
        `ロット ${bg5Lot.lotCode} の ePOD BG5 を受領署名しました`
      )
    );
    setBg5Lot(null);
    triggerRefresh();
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimLot) return;
    const res = await fetch('/api/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lotId: claimLot.id,
        affectedKg: Number(claimKg),
        description: claimDesc,
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi gửi khiếu nại', 'クレーム送信エラー'));
    pushToast(
      'success',
      tx(
        lang,
        `Đã mở khiếu nại ${data.claim.code}. Hệ thống đã dựng hồ sơ & khoanh vùng lỗi.`,
        `クレーム ${data.claim.code} を登録しました。システムがロット履歴と推定原因工程を自動構築しました。`
      )
    );
    setClaimLot(null);
    setClaimDesc('');
    triggerRefresh();
  };

  const handleConfirmStatement = async (id: string) => {
    const res = await fetch(`/api/billing/${id}`, { method: 'PATCH' });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi xác nhận bảng kê', '精算書確定エラー'));
    pushToast(
      'success',
      tx(
        lang,
        `Đã xác nhận bảng kê ${data.statement.code}`,
        `精算書 ${data.statement.code} を確定しました`
      )
    );
    triggerRefresh();
  };

  const allowedProducts = contract
    ? products.filter((p) => contract.allowedProductIds.includes(p.id))
    : [];
  const currentSt = statements[0];
  const committedKg = (contract?.committedTonsPerMonth ?? 200) * 1000;
  const acceptedKg = currentSt?.acceptedKg ?? 0;
  const progressPct = Math.min(100, Math.round((acceptedKg / committedKg) * 1000) / 10);

  return (
    <AppShell channel="customer">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {tx(lang, 'Cổng Khách hàng B2B', 'B2B顧客ポータル')} —{' '}
              {currentOrg ? displayOrgName(currentOrg.name, lang) : ''}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {tx(lang, 'Hợp đồng khung', '基本契約')} {contract?.code} ·{' '}
              {tx(lang, 'Đơn giá dịch vụ chuỗi lạnh:', 'コールドチェーン単価:')}{' '}
              <strong>
                {formatNum(contract?.unitPriceVndPerKg ?? 0, lang)} {tx(lang, 'đ/kg', 'VND/kg')}
              </strong>{' '}
              · {tx(lang, 'Giờ chốt đơn 14:00 D-1', '締切 14:00 D-1')}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap bg-blue-50 text-blue-700 border-blue-200">
            {tx(lang, 'Dữ liệu cô lập riêng tổ chức (NFR-07)', '組織別データ分離保護 (NFR-07)')}
          </span>
        </div>

        {/* Take-or-Pay Progress (FR-08) */}
        <Card
          title={tx(
            lang,
            'Sản lượng lũy kế tháng 11/2026 so với Cam kết Take-or-Pay (FR-08)',
            '2026年11月 累計納品量 vs Take-or-Pay 最低保証量 (FR-08)'
          )}
          subtitle={tx(
            lang,
            `Cam kết tối thiểu: ${formatNum(committedKg / 1000, lang)} tấn/tháng · Đã giao đạt chuẩn BG5: ${formatNum(acceptedKg / 1000, lang)} tấn`,
            `月間契約量: ${formatNum(committedKg / 1000, lang)} トン · BG5合格納品済: ${formatNum(acceptedKg / 1000, lang)} トン`
          )}
        >
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-emerald-700">
                {tx(lang, `Tiến độ: ${progressPct}%`, `進捗: ${progressPct}%`)}
              </span>
              <span className="text-slate-500">
                {acceptedKg >= committedKg
                  ? tx(lang, 'Đã đạt sản lượng cam kết', '月間契約数量を達成済')
                  : tx(
                      lang,
                      `Còn thiếu ${((committedKg - acceptedKg) / 1000).toFixed(1)} tấn`,
                      `残り ${((committedKg - acceptedKg) / 1000).toFixed(1)} トン`
                    )}
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Customer Service KPIs (FR-47) */}
        {kpiData && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpiData.metrics.map((rawMetric) => {
              const m = localizeKpiMetric(rawMetric, lang);
              return (
                <StatCard
                  key={m.key}
                  label={m.label}
                  value={`${m.actualValue} ${m.unit}`}
                  sub={`${tx(lang, 'SLA mục tiêu:', 'SLA目標:')} ${m.targetLabel}`}
                  tone={m.passed ? 'emerald' : 'rose'}
                />
              );
            })}
          </div>
        )}

        {/* Create Order & Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5">
            <Card
              title={tx(lang, 'Đặt đơn ngày D (FR-06)', 'D日日次注文の登録 (FR-06)')}
              subtitle={tx(
                lang,
                'Hệ thống chặn mặt hàng ngoài hợp đồng khung',
                '基本契約対象外の品目は自動的にブロックされます'
              )}
            >
              <form onSubmit={handleCreateOrder} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {tx(lang, 'Ngày giao (D)', '納品日 (D日)')}
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {tx(lang, 'Khung giờ', '希望時間帯')}
                    </label>
                    <select
                      value={timeSlot}
                      onChange={(e) => setTimeSlot(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="05:00-07:00">05:00–07:00</option>
                      <option value="06:00-08:00">06:00–08:00</option>
                      <option value="07:00-09:00">07:00–09:00</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {tx(lang, 'Điểm giao', '納品先拠点')}
                  </label>
                  <select
                    value={deliveryPointId}
                    onChange={(e) => setDeliveryPointId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {(contract?.deliveryPoints ?? []).map((dp) => (
                      <option key={dp.id} value={dp.id}>
                        {displayPlace(dp.name, lang)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {tx(lang, 'Mặt hàng trong HĐK', '契約品目 (HDK)')}
                    </label>
                    <select
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      {allowedProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {displayProductName(p.name, lang)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {tx(lang, 'Khối lượng (kg)', '注文数量 (kg)')}
                    </label>
                    <input
                      type="number"
                      min={10}
                      value={requestedKg}
                      onChange={(e) => setRequestedKg(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={afterCutoffTest}
                    onChange={(e) => setAfterCutoffTest(e.target.checked)}
                  />
                  <span>
                    {tx(
                      lang,
                      'Giả lập gửi lúc 15:30 D-1 (Sau giờ chốt 14:00 → Đơn Phát sinh)',
                      'D-1 15:30送信をシミュレート（14:00締切後 → 追加注文扱い）'
                    )}
                  </span>
                </label>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" /> {tx(lang, 'Gửi đơn ngày', '日次注文を送信')}
                </button>
              </form>
            </Card>
          </div>

          <div className="lg:col-span-7">
            <Card title={tx(lang, 'Đơn ngày của tôi', '自社の日次注文一覧')}>
              <ResponsiveTable
                data={orders}
                rowKey={(o) => o.id}
                columns={[
                  {
                    key: 'code',
                    header: tx(lang, 'Mã đơn / Ngày', '注文番号 / 納品日'),
                    render: (o) => (
                      <div>
                        <div className="font-mono text-xs font-bold">{o.code}</div>
                        <div className="text-[11px] text-slate-500">
                          {o.deliveryDate} · {o.timeSlot}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'items',
                    header: tx(lang, 'Mặt hàng', '品目・数量'),
                    render: (o) => (
                      <div className="text-xs">
                        {o.items.map((it) => (
                          <div key={it.productId}>
                            {prodName(it.productId)}: <strong>{formatNum(it.requestedKg, lang)} kg</strong>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: 'status',
                    header: tx(lang, 'Trạng thái', 'ステータス'),
                    render: (o) => <OrderStatusBadge status={o.status} />,
                  },
                ]}
              />
            </Card>
          </div>
        </div>

        {/* Customer Lots: Sign BG5 & File Claim */}
        <Card
          title={tx(
            lang,
            'Theo dõi Lô hàng, Ký nhận BG5 & Gửi Khiếu nại (FR-35, FR-36)',
            'ロット追跡・BG5受領署名・クレーム申請 (FR-35, FR-36)'
          )}
          subtitle={tx(
            lang,
            'Khi hàng đến điểm bán, ký ePOD BG5 (nhập kg đạt/không đạt). Có thể khiếu nại trong 24h sau BG5.',
            '納品拠点到着時に ePOD BG5（合格/不合格重量）へ署名します。BG5後24時間以内にクレーム申請が可能です。'
          )}
        >
          <ResponsiveTable
            data={lots.filter((l) => !l.id.startsWith('LOT-NOV-'))}
            rowKey={(l) => l.id}
            columns={[
              {
                key: 'lot',
                header: tx(lang, 'Mã lô / Mặt hàng', 'ロット番号 / 品目'),
                render: (l) => (
                  <div>
                    <div className="font-mono text-xs font-bold">{l.lotCode}</div>
                    <div className="text-xs text-slate-600">
                      {prodName(l.productId)} · {formatNum(l.currentKg, lang)} kg
                    </div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: tx(lang, 'Trạng thái', 'ステータス'),
                render: (l) => <LotStatusBadge status={l.status} />,
              },
              {
                key: 'bg5',
                header: tx(lang, 'Kết quả BG5', 'BG5検品結果'),
                render: (l) => {
                  const bg5 = epods.find((e) => e.lotId === l.id && e.stage === 'BG5');
                  return bg5 ? (
                    <span className="text-xs">
                      {tx(lang, 'Đạt', '合格')}{' '}
                      <strong>{formatNum(bg5.acceptedKg ?? bg5.actualKg, lang)} kg</strong> /{' '}
                      {tx(lang, 'Loại', '不合格')}{' '}
                      <strong className="text-rose-600">
                        {formatNum(bg5.rejectedKg ?? 0, lang)} kg
                      </strong>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {tx(lang, 'Chưa giao BG5', 'BG5未納品')}
                    </span>
                  );
                },
              },
              {
                key: 'actions',
                header: tx(lang, 'Thao tác', '操作'),
                render: (l) => (
                  <div className="flex flex-wrap gap-1.5 justify-end md:justify-start">
                    {l.status === 'DANG_GIAO' && (
                      <button
                        onClick={() => {
                          setBg5Lot(l);
                          setBg5ActualKg(l.currentKg);
                          setBg5AcceptedKg(l.currentKg);
                          setBg5RejectedKg(0);
                          setBg5Reason('');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                      >
                        <PackageCheck className="w-3.5 h-3.5" /> {tx(lang, 'Ký BG5', 'BG5署名')}
                      </button>
                    )}
                    {l.status === 'DA_GIAO' && (
                      <button
                        onClick={() => {
                          setClaimLot(l);
                          setClaimKg(50);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                      >
                        <FileWarning className="w-3.5 h-3.5" />{' '}
                        {tx(lang, 'Khiếu nại (24h)', 'クレーム申請 (24h)')}
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>

        {/* Statements & Claims */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title={tx(lang, 'Bảng kê đối soát tháng của tôi (FR-43)', '自社の月次精算書 (FR-43)')}>
            {statements.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold">{s.code}</span>
                  <StatementStatusBadge status={s.status} />
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>
                    {tx(lang, 'Sản lượng tính cước Take-or-Pay:', 'Take-or-Pay 課金対象量:')}{' '}
                    <strong>{formatNum(s.billableKg, lang)} kg</strong>
                  </div>
                  <div>
                    {tx(lang, 'Giảm trừ bồi hoàn:', 'クレーム補償控除:')}{' '}
                    <strong className="text-rose-600">
                      -{formatVnd(s.deductionOrPenaltyVnd, lang)}
                    </strong>
                  </div>
                  <div className="text-sm font-bold text-emerald-700 pt-1">
                    {tx(lang, 'Tổng thanh toán:', '請求総額:')} {formatVnd(s.netAmountVnd, lang)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.status !== 'DA_XAC_NHAN' && (
                    <button
                      onClick={() => handleConfirmStatement(s.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />{' '}
                      {tx(lang, 'Xác nhận bảng kê', '精算書を確定')}
                    </button>
                  )}
                  <a
                    href={`/api/billing/export?statementId=${s.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />{' '}
                    {tx(lang, 'Tải CSV/Excel', 'CSV/Excel ダウンロード')}
                  </a>
                </div>
              </div>
            ))}
          </Card>

          <Card title={tx(lang, 'Khiếu nại của tôi', '自社のクレーム履歴')}>
            {claims.length === 0 ? (
              <p className="text-xs text-slate-500">
                {tx(lang, 'Không có khiếu nại nào.', 'クレーム履歴はありません。')}
              </p>
            ) : (
              <div className="space-y-2.5">
                {claims.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="font-mono font-bold">{c.code}</span>
                      <ClaimStatusBadge status={c.status} />
                    </div>
                    <p className="text-slate-600">{displayOperationalText(c.description, lang)}</p>
                    {c.decision && (
                      <p className="text-emerald-700 font-semibold">
                        {tx(lang, 'Bồi hoàn:', '補償額:')}{' '}
                        {formatVnd(c.decision.customerCompensationVnd, lang)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Sign BG5 Modal */}
      <Modal
        open={Boolean(bg5Lot)}
        onClose={() => setBg5Lot(null)}
        title={tx(
          lang,
          `Ký nhận ePOD BG5 — Lô ${bg5Lot?.lotCode ?? ''}`,
          `ePOD BG5 受領署名 — ロット ${bg5Lot?.lotCode ?? ''}`
        )}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSignBg5} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {tx(lang, 'Thực nhận (kg)', '実受領重量 (kg)')}
              </label>
              <input
                type="number"
                value={bg5ActualKg}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setBg5ActualKg(v);
                  setBg5AcceptedKg(Math.max(0, v - bg5RejectedKg));
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {tx(lang, 'Nhiệt độ đo (°C)', '測定温度 (°C)')}
              </label>
              <input
                type="number"
                step="0.1"
                value={bg5TempC}
                onChange={(e) => setBg5TempC(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {tx(lang, 'Kg Đạt chuẩn', '合格重量 (kg)')}
              </label>
              <input
                type="number"
                value={bg5AcceptedKg}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setBg5AcceptedKg(v);
                  setBg5RejectedKg(Math.max(0, bg5ActualKg - v));
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {tx(lang, 'Kg Không đạt', '不合格重量 (kg)')}
              </label>
              <input
                type="number"
                value={bg5RejectedKg}
                onChange={(e) => setBg5RejectedKg(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {tx(
                lang,
                'Lý do (bắt buộc nếu có hàng không đạt hoặc lệch >2%)',
                '理由（不合格品または2%超の重量差異がある場合は必須）'
              )}
            </label>
            <textarea
              value={bg5Reason}
              onChange={(e) => setBg5Reason(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBg5Lot(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
            >
              {tx(lang, 'Hủy', 'キャンセル')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              {tx(lang, 'Xác nhận ePOD BG5', 'ePOD BG5 を確定')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Claim Modal */}
      <Modal
        open={Boolean(claimLot)}
        onClose={() => setClaimLot(null)}
        title={tx(
          lang,
          `Gửi khiếu nại lô ${claimLot?.lotCode ?? ''} (BR-11)`,
          `ロット ${claimLot?.lotCode ?? ''} クレーム申請 (BR-11)`
        )}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateClaim} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {tx(lang, 'Khối lượng bị ảnh hưởng (kg)', '被害・影響重量 (kg)')}
            </label>
            <input
              type="number"
              value={claimKg}
              onChange={(e) => setClaimKg(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {tx(lang, 'Mô tả tình trạng hàng', '品質異常・状況の詳細')}
            </label>
            <textarea
              value={claimDesc}
              onChange={(e) => setClaimDesc(e.target.value)}
              rows={3}
              placeholder={tx(
                lang,
                'VD: Lá bị dập và úa vàng khi mở thùng tại điểm giao...',
                '例: 配送先で開梱時に葉の傷みと黄変を確認...'
              )}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setClaimLot(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
            >
              {tx(lang, 'Hủy', 'キャンセル')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
            >
              {tx(lang, 'Gửi khiếu nại', 'クレームを送信')}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
