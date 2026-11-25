'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, ClipboardCheck, Send, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, OrderStatusBadge } from '@/components/ui/Badge';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { Modal } from '@/components/ui/Modal';
import { useCct } from '@/components/layout/CctContext';
import { tx } from '@/lib/i18n';
import { DailyOrder, SupplyPlan } from '@/types/order-plan';
import { Organization } from '@/types/common';
import { Product, TempGroup } from '@/types/catalog';

export function OrdersPlanPanel() {
  const { refreshTick, pushToast, triggerRefresh, lang } = useCct();
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [plans, setPlans] = useState<SupplyPlan[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tempGroups, setTempGroups] = useState<TempGroup[]>([]);
  const [planDate, setPlanDate] = useState('2026-11-26');
  const [rejectModal, setRejectModal] = useState<DailyOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    const [oRes, pRes, cRes] = await Promise.all([
      fetch('/api/orders', { cache: 'no-store' }),
      fetch('/api/plans', { cache: 'no-store' }),
      fetch('/api/catalog', { cache: 'no-store' }),
    ]);
    if (oRes.ok) setOrders((await oRes.json()).orders ?? []);
    if (pRes.ok) setPlans((await pRes.json()).plans ?? []);
    if (cRes.ok) {
      const cat = await cRes.json();
      setOrgs(cat.organizations ?? []);
      setProducts(cat.products ?? []);
      setTempGroups(cat.tempGroups ?? []);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTick]);

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? id;
  const prodName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const tgName = (id: string) => tempGroups.find((t) => t.id === id)?.name ?? id;

  const handleConfirmOrder = async (order: DailyOrder) => {
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CONFIRM' }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi xác nhận đơn');
    pushToast('success', `Đã xác nhận đơn ${order.code}`);
    triggerRefresh();
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModal) return;
    const res = await fetch(`/api/orders/${rejectModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REJECT', rejectionReason: rejectReason }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi từ chối đơn');
    pushToast('info', `Đã từ chối đơn ${rejectModal.code}`);
    setRejectModal(null);
    setRejectReason('');
    triggerRefresh();
  };

  const handleGeneratePlan = async () => {
    const res = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planDate, action: 'GENERATE' }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi tổng hợp kế hoạch');
    pushToast('success', `Đã tổng hợp kế hoạch ngày ${planDate} (đã cộng hệ số hao hụt FR-09)`);
    triggerRefresh();
  };

  const handlePublishPlan = async () => {
    const res = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planDate, action: 'PUBLISH' }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi phát hành kế hoạch');
    pushToast('success', `Đã phát hành kế hoạch cung ứng ngày ${planDate} đến HTX & Khách hàng`);
    triggerRefresh();
  };

  const activePlan = plans.find((p) => p.planDate === planDate) ?? plans[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          {tx(lang, 'Đơn ngày D & Kế hoạch cung ứng (Bước 1–2)', 'D日注文・供給計画策定 (ステップ 1–2)')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          {tx(
            lang,
            'Giờ chốt đơn 14:00 D-1 (BR-01). Đơn gửi sau giờ chốt gắn nhãn Phát sinh chờ điều phối duyệt (BR-02).',
            '締切はD-1 14:00 (BR-01)。締切後の注文は「追加(締切後)」としてコーディネーター承認待ちになります (BR-02)。'
          )}
        </p>
      </div>

      {/* Daily Orders Table */}
      <Card
        title="Danh sách Đơn ngày"
        subtitle="Bao gồm đơn đúng hạn và đơn phát sinh sau 14:00 D-1"
      >
        <ResponsiveTable
          data={orders}
          rowKey={(o) => o.id}
          columns={[
            {
              key: 'code',
              header: 'Mã đơn',
              render: (o) => (
                <div>
                  <div className="font-mono text-xs font-bold text-slate-900">{o.code}</div>
                  <div className="text-[11px] text-slate-500">{o.deliveryDate} · {o.timeSlot}</div>
                </div>
              ),
            },
            {
              key: 'customer',
              header: 'Khách hàng / Điểm giao',
              render: (o) => (
                <div>
                  <div className="text-xs font-semibold text-slate-900">{orgName(o.customerOrgId)}</div>
                  <div className="text-[11px] text-slate-500">{o.deliveryPointName}</div>
                </div>
              ),
            },
            {
              key: 'items',
              header: 'Mặt hàng & Khối lượng',
              render: (o) => (
                <div className="space-y-0.5 text-xs">
                  {o.items.map((it) => (
                    <div key={it.productId}>
                      {prodName(it.productId)}: <strong>{it.requestedKg.toLocaleString('vi-VN')} kg</strong>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Trạng thái',
              render: (o) => (
                <div className="flex flex-col items-end md:items-start gap-1">
                  <OrderStatusBadge status={o.status} />
                  {o.rejectionReason && (
                    <span className="text-[11px] text-rose-600">{o.rejectionReason}</span>
                  )}
                </div>
              ),
            },
            {
              key: 'actions',
              header: 'Điều phối',
              render: (o) =>
                o.status === 'PHAT_SINH' || o.status === 'DA_NHAN' ? (
                  <div className="flex items-center gap-1.5 justify-end md:justify-start">
                    <button
                      onClick={() => handleConfirmOrder(o)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                    >
                      <Check className="w-3.5 h-3.5" /> Duyệt
                    </button>
                    <button
                      onClick={() => setRejectModal(o)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Từ chối
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Đã xử lý</span>
                ),
            },
          ]}
        />
      </Card>

      {/* Supply Plan Aggregator */}
      <Card
        title="Tổng hợp nhu cầu & Kế hoạch thu hoạch (FR-09, FR-10, FR-11)"
        subtitle="Tổng hợp đơn theo mặt hàng/nhóm nhiệt + cộng hệ số hao hụt dự phòng & theo dõi xác nhận HTX"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium"
            />
            <button
              onClick={handleGeneratePlan}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-600 text-emerald-700 text-xs font-semibold hover:bg-emerald-50"
            >
              <ClipboardCheck className="w-3.5 h-3.5" /> Tổng hợp nhu cầu
            </button>
            <button
              onClick={handlePublishPlan}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
            >
              <Send className="w-3.5 h-3.5" /> Phát hành kế hoạch
            </button>
          </div>
        }
      >
        {activePlan ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-slate-900">{activePlan.code}</span>
                <Badge tone={activePlan.status === 'DA_PHAT_HANH' ? 'emerald' : 'amber'}>
                  {activePlan.status === 'DA_PHAT_HANH' ? 'Đã phát hành' : 'Bản nháp'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                {Object.entries(activePlan.storageDemandByTempGroup).map(([tgId, kg]) => (
                  <span key={tgId}>
                    Nhu cầu kho <strong>{tgName(tgId)}</strong>: {kg.toLocaleString('vi-VN')} kg
                  </span>
                ))}
                <span>Chuyến dự kiến: <strong>{activePlan.plannedTripCount}</strong></span>
              </div>
            </div>

            <ResponsiveTable
              data={activePlan.allocations}
              rowKey={(a) => a.id}
              columns={[
                {
                  key: 'sup',
                  header: 'Nhà cung cấp (HTX)',
                  render: (a) => <span className="text-xs font-semibold">{orgName(a.supplierOrgId)}</span>,
                },
                {
                  key: 'prod',
                  header: 'Mặt hàng',
                  render: (a) => <span className="text-xs">{prodName(a.productId)}</span>,
                },
                {
                  key: 'net',
                  header: 'Nhu cầu đơn / Hao hụt',
                  render: (a) => (
                    <span className="text-xs">
                      {a.netOrderKg.toLocaleString('vi-VN')} kg (+{a.bufferPct}%)
                    </span>
                  ),
                },
                {
                  key: 'raw',
                  header: 'Sản lượng cần thu hoạch',
                  render: (a) => (
                    <span className="text-xs font-bold text-emerald-700">
                      {a.requiredRawKg.toLocaleString('vi-VN')} kg
                    </span>
                  ),
                },
                {
                  key: 'conf',
                  header: 'Xác nhận HTX & Nguồn gốc',
                  render: (a) => {
                    const actual = a.confirmedKg ?? a.proposedKg;
                    const shortage = actual !== undefined && actual < a.requiredRawKg;
                    return (
                      <div className="space-y-1">
                        <Badge
                          tone={
                            a.confirmationStatus === 'DA_XAC_NHAN'
                              ? 'emerald'
                              : a.confirmationStatus === 'DE_XUAT_KHAC'
                                ? 'amber'
                                : 'slate'
                          }
                        >
                          {a.confirmationStatus === 'DA_XAC_NHAN'
                            ? `Đã xác nhận (${actual ?? a.requiredRawKg} kg)`
                            : a.confirmationStatus === 'DE_XUAT_KHAC'
                              ? `Đề xuất khác (${a.proposedKg ?? 0} kg)`
                              : 'Chờ HTX xác nhận'}
                        </Badge>
                        {shortage && (
                          <div className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-medium">
                            <AlertCircle className="w-3 h-3" /> Thiếu hàng so với nhu cầu!
                          </div>
                        )}
                        {a.originDeclaration && (
                          <div className="text-[11px] text-slate-500">
                            {a.originDeclaration.growingArea} · {a.originDeclaration.certCode || 'Không có chứng nhận'}
                          </div>
                        )}
                      </div>
                    );
                  },
                },
              ]}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Chưa có kế hoạch cung ứng cho ngày {planDate}.</p>
        )}
      </Card>

      {/* Reject Reason Modal */}
      <Modal
        open={Boolean(rejectModal)}
        onClose={() => setRejectModal(null)}
        title={`Từ chối đơn phát sinh ${rejectModal?.code ?? ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRejectSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Lý do từ chối (bắt buộc theo FR-07)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="VD: Không đủ nguồn cung cải xanh bổ sung sau 14:00 D-1..."
              className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejectModal(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
            >
              Xác nhận từ chối
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
