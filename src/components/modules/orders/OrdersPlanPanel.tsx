'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, ClipboardCheck, Send, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { AllocConfirmBadge, Badge, OrderStatusBadge } from '@/components/ui/Badge';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { Modal } from '@/components/ui/Modal';
import { useCct } from '@/components/layout/CctContext';
import {
  displayOrgName,
  displayPlace,
  displayProductName,
  displayTempGroupName,
  formatNum,
  tx,
} from '@/lib/i18n';
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

  const orgName = (id: string) => displayOrgName(orgs.find((o) => o.id === id)?.name ?? id, lang);
  const prodName = (id: string) => displayProductName(products.find((p) => p.id === id)?.name ?? id, lang);
  const tgName = (id: string) => displayTempGroupName(tempGroups.find((t) => t.id === id)?.name ?? id, lang);

  const handleConfirmOrder = async (order: DailyOrder) => {
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CONFIRM' }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi xác nhận đơn', '注文承認エラー'));
    pushToast(
      'success',
      tx(lang, `Đã xác nhận đơn ${order.code}`, `注文 ${order.code} を承認確定しました`)
    );
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
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi từ chối đơn', '注文却下エラー'));
    pushToast(
      'info',
      tx(lang, `Đã từ chối đơn ${rejectModal.code}`, `注文 ${rejectModal.code} を却下しました`)
    );
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
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi tổng hợp kế hoạch', '計画集計エラー'));
    pushToast(
      'success',
      tx(
        lang,
        `Đã tổng hợp kế hoạch ngày ${planDate} (đã cộng hệ số hao hụt FR-09)`,
        `${planDate} の供給計画を集計しました（歩留まり予備係数加算済 FR-09）`
      )
    );
    triggerRefresh();
  };

  const handlePublishPlan = async () => {
    const res = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planDate, action: 'PUBLISH' }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi phát hành kế hoạch', '計画発行エラー'));
    pushToast(
      'success',
      tx(
        lang,
        `Đã phát hành kế hoạch cung ứng ngày ${planDate} đến HTX & Khách hàng`,
        `${planDate} の供給計画を農協 (HTX) および顧客へ発行しました`
      )
    );
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
            '締切はD-1 14:00 (BR-01)。締切後の注文は「締切後追加」としてコーディネーター承認待ちになります (BR-02)。'
          )}
        </p>
      </div>

      {/* Daily Orders Table */}
      <Card
        title={tx(lang, 'Danh sách Đơn ngày', '日次注文一覧')}
        subtitle={tx(
          lang,
          'Bao gồm đơn đúng hạn và đơn phát sinh sau 14:00 D-1',
          '定刻注文および D-1 14:00 締切後の追加注文を含む'
        )}
      >
        <ResponsiveTable
          data={orders}
          rowKey={(o) => o.id}
          columns={[
            {
              key: 'code',
              header: tx(lang, 'Mã đơn', '注文番号'),
              render: (o) => (
                <div>
                  <div className="font-mono text-xs font-bold text-slate-900">{o.code}</div>
                  <div className="text-[11px] text-slate-500">
                    {o.deliveryDate} · {o.timeSlot}
                  </div>
                </div>
              ),
            },
            {
              key: 'customer',
              header: tx(lang, 'Khách hàng / Điểm giao', '顧客 / 納品先拠点'),
              render: (o) => (
                <div>
                  <div className="text-xs font-semibold text-slate-900">{orgName(o.customerOrgId)}</div>
                  <div className="text-[11px] text-slate-500">{displayPlace(o.deliveryPointName, lang)}</div>
                </div>
              ),
            },
            {
              key: 'items',
              header: tx(lang, 'Mặt hàng & Khối lượng', '品目・数量'),
              render: (o) => (
                <div className="space-y-0.5 text-xs">
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
              header: tx(lang, 'Điều phối', '配車・承認操作'),
              render: (o) =>
                o.status === 'PHAT_SINH' || o.status === 'DA_NHAN' ? (
                  <div className="flex items-center gap-1.5 justify-end md:justify-start">
                    <button
                      onClick={() => handleConfirmOrder(o)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                    >
                      <Check className="w-3.5 h-3.5" /> {tx(lang, 'Duyệt', '承認')}
                    </button>
                    <button
                      onClick={() => setRejectModal(o)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> {tx(lang, 'Từ chối', '却下')}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">{tx(lang, 'Đã xử lý', '処理済')}</span>
                ),
            },
          ]}
        />
      </Card>

      {/* Supply Plan Aggregator */}
      <Card
        title={tx(lang, 'Tổng hợp nhu cầu & Kế hoạch thu hoạch (FR-09, FR-10, FR-11)', '需要集計・収穫計画 (FR-09, FR-10, FR-11)')}
        subtitle={tx(
          lang,
          'Tổng hợp đơn theo mặt hàng/nhóm nhiệt + cộng hệ số hao hụt dự phòng & theo dõi xác nhận HTX',
          '品目・温度帯別集計＋歩留まり予備係数加算・農協 (HTX) 回答状況管理'
        )}
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
              <ClipboardCheck className="w-3.5 h-3.5" /> {tx(lang, 'Tổng hợp nhu cầu', '需要集計')}
            </button>
            <button
              onClick={handlePublishPlan}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
            >
              <Send className="w-3.5 h-3.5" /> {tx(lang, 'Phát hành kế hoạch', '計画発行')}
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
                  {activePlan.status === 'DA_PHAT_HANH'
                    ? tx(lang, 'Đã phát hành', '発行済')
                    : tx(lang, 'Bản nháp', '下書き')}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                {Object.entries(activePlan.storageDemandByTempGroup).map(([tgId, kg]) => (
                  <span key={tgId}>
                    {tx(lang, 'Nhu cầu kho', '保管需要')} <strong>{tgName(tgId)}</strong>:{' '}
                    {formatNum(kg, lang)} kg
                  </span>
                ))}
                <span>
                  {tx(lang, 'Chuyến dự kiến:', '予定便数:')}{' '}
                  <strong>{activePlan.plannedTripCount}</strong>
                </span>
              </div>
            </div>

            <ResponsiveTable
              data={activePlan.allocations}
              rowKey={(a) => a.id}
              columns={[
                {
                  key: 'sup',
                  header: tx(lang, 'Nhà cung cấp (HTX)', 'サプライヤー (HTX)'),
                  render: (a) => <span className="text-xs font-semibold">{orgName(a.supplierOrgId)}</span>,
                },
                {
                  key: 'prod',
                  header: tx(lang, 'Mặt hàng', '品目'),
                  render: (a) => <span className="text-xs">{prodName(a.productId)}</span>,
                },
                {
                  key: 'net',
                  header: tx(lang, 'Nhu cầu đơn / Hao hụt', '注文需要 / 予備係数'),
                  render: (a) => (
                    <span className="text-xs">
                      {formatNum(a.netOrderKg, lang)} kg (+{a.bufferPct}%)
                    </span>
                  ),
                },
                {
                  key: 'raw',
                  header: tx(lang, 'Sản lượng cần thu hoạch', '必要収穫量'),
                  render: (a) => (
                    <span className="text-xs font-bold text-emerald-700">
                      {formatNum(a.requiredRawKg, lang)} kg
                    </span>
                  ),
                },
                {
                  key: 'conf',
                  header: tx(lang, 'Xác nhận HTX & Nguồn gốc', 'HTX確認・産地情報'),
                  render: (a) => {
                    const actual = a.confirmedKg ?? a.proposedKg;
                    const shortage = actual !== undefined && actual < a.requiredRawKg;
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <AllocConfirmBadge status={a.confirmationStatus} />
                          {(a.confirmationStatus === 'DA_XAC_NHAN' ||
                            a.confirmationStatus === 'DE_XUAT_KHAC') && (
                            <span className="text-[11px] font-semibold text-slate-700">
                              ({formatNum(actual ?? a.requiredRawKg, lang)} kg)
                            </span>
                          )}
                        </div>
                        {shortage && (
                          <div className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-medium">
                            <AlertCircle className="w-3 h-3" />{' '}
                            {tx(lang, 'Thiếu hàng so với nhu cầu!', '必要数量に対して不足しています！')}
                          </div>
                        )}
                        {a.originDeclaration && (
                          <div className="text-[11px] text-slate-500">
                            {displayPlace(a.originDeclaration.growingArea, lang)} ·{' '}
                            {a.originDeclaration.certCode || tx(lang, 'Không có chứng nhận', '認証なし')}
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
          <p className="text-sm text-slate-500">
            {tx(lang, `Chưa có kế hoạch cung ứng cho ngày ${planDate}.`, `${planDate} の供給計画はまだ作成されていません。`)}
          </p>
        )}
      </Card>

      {/* Reject Reason Modal */}
      <Modal
        open={Boolean(rejectModal)}
        onClose={() => setRejectModal(null)}
        title={tx(lang, `Từ chối đơn phát sinh ${rejectModal?.code ?? ''}`, `追加注文 ${rejectModal?.code ?? ''} を却下`)}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRejectSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tx(lang, 'Lý do từ chối (bắt buộc theo FR-07)', '却下理由（FR-07により必須）')}
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder={tx(
                lang,
                'VD: Không đủ nguồn cung cải xanh bổ sung sau 14:00 D-1...',
                '例: D-1 14:00以降の追加分に必要な青菜の供給枠が不足しています...'
              )}
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
              {tx(lang, 'Hủy', 'キャンセル')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
            >
              {tx(lang, 'Xác nhận từ chối', '却下を確定')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
