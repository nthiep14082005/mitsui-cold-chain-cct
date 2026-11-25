'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileWarning,
  PackageCheck,
  Plus,
  ShoppingCart,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useCct } from '@/components/layout/CctContext';
import { tx } from '@/lib/i18n';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge, LotStatusBadge, OrderStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { FrameworkContract, Product } from '@/types/catalog';
import { DailyOrder } from '@/types/order-plan';
import { EpodRecord, Lot } from '@/types/lot-epod';
import { Claim, KpiDashboardData, MonthlyStatement } from '@/types/claim-billing-kpi';

export default function CustomerPortalPage() {
  const { currentUser, currentOrg, refreshTick, pushToast, triggerRefresh, switchUser, demoUsers, lang } = useCct();

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

  const prodName = (id: string) => products.find((p) => p.id === id)?.name ?? id;

  if (currentUser && currentUser.role !== 'KHACH_HANG') {
    const customerAccounts = demoUsers.filter((u) => u.role === 'KHACH_HANG');
    return (
      <AppShell channel="customer">
        <Card
          title="Kênh Web Khách hàng B2B (NFR-07)"
          subtitle="Vui lòng chọn một tài khoản Khách hàng B2B để xem đơn hàng, tiến độ Take-or-Pay và bảng kê của riêng tổ chức đó."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {customerAccounts.map((u) => (
              <button
                key={u.id}
                onClick={() => switchUser(u.id)}
                className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 text-left transition"
              >
                <div className="text-sm font-bold text-slate-900">{u.orgName}</div>
                <div className="text-xs text-slate-600 mt-1">{u.name}</div>
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
    if (!res.ok) return pushToast('error', data.error || 'Lỗi tạo đơn');
    pushToast(
      data.order.isAdHoc ? 'warning' : 'success',
      data.order.isAdHoc
        ? `Đơn ${data.order.code} gửi sau 14:00 D-1 → Trạng thái Phát sinh chờ Mitsui duyệt (BR-02)`
        : `Đã gửi đơn ngày ${data.order.code} thành công!`
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
    if (!res.ok) return pushToast('error', data.error || 'Lỗi ký BG5');
    pushToast('success', `Đã ký nhận ePOD BG5 cho lô ${bg5Lot.lotCode}`);
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
    if (!res.ok) return pushToast('error', data.error || 'Lỗi gửi khiếu nại');
    pushToast('success', `Đã mở khiếu nại ${data.claim.code}. Hệ thống đã dựng hồ sơ & khoanh vùng lỗi.`);
    setClaimLot(null);
    setClaimDesc('');
    triggerRefresh();
  };

  const handleConfirmStatement = async (id: string) => {
    const res = await fetch(`/api/billing/${id}`, { method: 'PATCH' });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi xác nhận bảng kê');
    pushToast('success', `Đã xác nhận bảng kê ${data.statement.code}`);
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
              {tx(lang, 'Cổng Khách hàng B2B', 'B2B顧客ポータル')} — {currentOrg?.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {tx(lang, 'Hợp đồng khung', '基本契約')} {contract?.code} ·{' '}
              {tx(lang, 'Đơn giá dịch vụ chuỗi lạnh:', 'コールドチェーン単価:')}{' '}
              <strong>{contract?.unitPriceVndPerKg.toLocaleString('vi-VN')} đ/kg</strong> ·{' '}
              {tx(lang, 'Giờ chốt đơn 14:00 D-1', '締切 14:00 D-1')}
            </p>
          </div>
          <Badge tone="blue">
            {tx(lang, 'Dữ liệu cô lập riêng tổ chức (NFR-07)', '組織別データ分離保護 (NFR-07)')}
          </Badge>
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
            `Cam kết tối thiểu: ${(committedKg / 1000).toLocaleString('vi-VN')} tấn/tháng · Đã giao đạt chuẩn BG5: ${(acceptedKg / 1000).toLocaleString('vi-VN')} tấn`,
            `月間契約量: ${(committedKg / 1000).toLocaleString('vi-VN')} トン · BG5合格納品済: ${(acceptedKg / 1000).toLocaleString('vi-VN')} トン`
          )}
        >
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-emerald-700">Tiến độ: {progressPct}%</span>
              <span className="text-slate-500">
                {acceptedKg >= committedKg
                  ? 'Đã đạt sản lượng cam kết'
                  : `Còn thiếu ${((committedKg - acceptedKg) / 1000).toFixed(1)} tấn`}
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
            {kpiData.metrics.map((m) => (
              <StatCard
                key={m.key}
                label={m.label}
                value={`${m.actualValue} ${m.unit}`}
                sub={`SLA mục tiêu: ${m.targetLabel}`}
                tone={m.passed ? 'emerald' : 'rose'}
              />
            ))}
          </div>
        )}

        {/* Create Order & Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5">
            <Card
              title="Đặt đơn ngày D (FR-06)"
              subtitle="Hệ thống chặn mặt hàng ngoài hợp đồng khung"
            >
              <form onSubmit={handleCreateOrder} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Ngày giao (D)</label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Khung giờ</label>
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
                  <label className="block text-xs font-medium text-slate-600 mb-1">Điểm giao</label>
                  <select
                    value={deliveryPointId}
                    onChange={(e) => setDeliveryPointId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {(contract?.deliveryPoints ?? []).map((dp) => (
                      <option key={dp.id} value={dp.id}>
                        {dp.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Mặt hàng trong HĐK</label>
                    <select
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      {allowedProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Khối lượng (kg)</label>
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
                  <span>Giả lập gửi lúc 15:30 D-1 (Sau giờ chốt 14:00 → Đơn Phát sinh)</span>
                </label>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" /> Gửi đơn ngày
                </button>
              </form>
            </Card>
          </div>

          <div className="lg:col-span-7">
            <Card title="Đơn ngày của tôi">
              <ResponsiveTable
                data={orders}
                rowKey={(o) => o.id}
                columns={[
                  {
                    key: 'code',
                    header: 'Mã đơn / Ngày',
                    render: (o) => (
                      <div>
                        <div className="font-mono text-xs font-bold">{o.code}</div>
                        <div className="text-[11px] text-slate-500">{o.deliveryDate} · {o.timeSlot}</div>
                      </div>
                    ),
                  },
                  {
                    key: 'items',
                    header: 'Mặt hàng',
                    render: (o) => (
                      <div className="text-xs">
                        {o.items.map((it) => (
                          <div key={it.productId}>
                            {prodName(it.productId)}: <strong>{it.requestedKg} kg</strong>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Trạng thái',
                    render: (o) => <OrderStatusBadge status={o.status} />,
                  },
                ]}
              />
            </Card>
          </div>
        </div>

        {/* Customer Lots: Sign BG5 & File Claim */}
        <Card
          title="Theo dõi Lô hàng, Ký nhận BG5 & Gửi Khiếu nại (FR-35, FR-36)"
          subtitle="Khi hàng đến điểm bán, ký ePOD BG5 (nhập kg đạt/không đạt). Có thể khiếu nại trong 24h sau BG5."
        >
          <ResponsiveTable
            data={lots.filter((l) => !l.id.startsWith('LOT-NOV-'))}
            rowKey={(l) => l.id}
            columns={[
              {
                key: 'lot',
                header: 'Mã lô / Mặt hàng',
                render: (l) => (
                  <div>
                    <div className="font-mono text-xs font-bold">{l.lotCode}</div>
                    <div className="text-xs text-slate-600">
                      {prodName(l.productId)} · {l.currentKg} kg
                    </div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Trạng thái',
                render: (l) => <LotStatusBadge status={l.status} />,
              },
              {
                key: 'bg5',
                header: 'Kết quả BG5',
                render: (l) => {
                  const bg5 = epods.find((e) => e.lotId === l.id && e.stage === 'BG5');
                  return bg5 ? (
                    <span className="text-xs">
                      Đạt <strong>{bg5.acceptedKg ?? bg5.actualKg} kg</strong> / Loại{' '}
                      <strong className="text-rose-600">{bg5.rejectedKg ?? 0} kg</strong>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Chưa giao BG5</span>
                  );
                },
              },
              {
                key: 'actions',
                header: 'Thao tác',
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
                        <PackageCheck className="w-3.5 h-3.5" /> Ký BG5
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
                        <FileWarning className="w-3.5 h-3.5" /> Khiếu nại (24h)
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
          <Card title="Bảng kê đối soát tháng của tôi (FR-43)">
            {statements.map((s) => (
              <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold">{s.code}</span>
                  <Badge tone={s.status === 'DA_XAC_NHAN' ? 'emerald' : 'amber'}>
                    {s.status === 'DA_XAC_NHAN' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>Sản lượng tính cước Take-or-Pay: <strong>{s.billableKg.toLocaleString('vi-VN')} kg</strong></div>
                  <div>Giảm trừ bồi hoàn: <strong className="text-rose-600">-{s.deductionOrPenaltyVnd.toLocaleString('vi-VN')} đ</strong></div>
                  <div className="text-sm font-bold text-emerald-700 pt-1">
                    Tổng thanh toán: {s.netAmountVnd.toLocaleString('vi-VN')} đ
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.status !== 'DA_XAC_NHAN' && (
                    <button
                      onClick={() => handleConfirmStatement(s.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Xác nhận bảng kê
                    </button>
                  )}
                  <a
                    href={`/api/billing/export?statementId=${s.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" /> Tải CSV/Excel
                  </a>
                </div>
              </div>
            ))}
          </Card>

          <Card title="Khiếu nại của tôi">
            {claims.length === 0 ? (
              <p className="text-xs text-slate-500">Không có khiếu nại nào.</p>
            ) : (
              <div className="space-y-2.5">
                {claims.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="font-mono font-bold">{c.code}</span>
                      <Badge tone={c.status === 'DA_PHAN_QUYET' ? 'emerald' : 'amber'}>
                        {c.status}
                      </Badge>
                    </div>
                    <p className="text-slate-600">{c.description}</p>
                    {c.decision && (
                      <p className="text-emerald-700 font-semibold">
                        Bồi hoàn: {c.decision.customerCompensationVnd.toLocaleString('vi-VN')} đ
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
        title={`Ký nhận ePOD BG5 — Lô ${bg5Lot?.lotCode ?? ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSignBg5} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Thực nhận (kg)</label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Nhiệt độ đo (°C)</label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Kg Đạt chuẩn</label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Kg Không đạt</label>
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
              Lý do (bắt buộc nếu có hàng không đạt hoặc lệch &gt;2%)
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
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              Xác nhận ePOD BG5
            </button>
          </div>
        </form>
      </Modal>

      {/* Claim Modal */}
      <Modal
        open={Boolean(claimLot)}
        onClose={() => setClaimLot(null)}
        title={`Gửi khiếu nại lô ${claimLot?.lotCode ?? ''} (BR-11)`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateClaim} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Khối lượng bị ảnh hưởng (kg)
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Mô tả tình trạng hàng</label>
            <textarea
              value={claimDesc}
              onChange={(e) => setClaimDesc(e.target.value)}
              rows={3}
              placeholder="VD: Lá bị dập và úa vàng khi mở thùng tại điểm giao..."
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
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
            >
              Gửi khiếu nại
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
