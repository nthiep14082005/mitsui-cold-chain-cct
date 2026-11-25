'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calculator, CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { useCct } from '@/components/layout/CctContext';
import { tx } from '@/lib/i18n';
import { MonthlyStatement } from '@/types/claim-billing-kpi';
import { Organization } from '@/types/common';

interface FinancialReport {
  month: string;
  totalRevenueVnd: number;
  totalPartnerCostVnd: number;
  contributionMarginVnd: number;
  contributionMarginPerKg: number;
  fixedOverheadVnd: number;
  operatingProfitVnd: number;
  actualTons: number;
  billableTons: number;
  breakEvenTons: number;
  breakEvenReached: boolean;
  coordCostPerKg: number;
  coordCostTargetMin: number;
  coordCostTargetMax: number;
}

export function BillingPanel() {
  const { refreshTick, pushToast, triggerRefresh, currentUser, lang } = useCct();
  const [month, setMonth] = useState('2026-11');
  const [statements, setStatements] = useState<MonthlyStatement[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [report, setReport] = useState<FinancialReport | null>(null);

  // Interactive Take-or-Pay Verifier (BR-12)
  const [simCommitTons, setSimCommitTons] = useState(200);
  const [simDeliveredTons, setSimDeliveredTons] = useState(180);
  const [simPrice, setSimPrice] = useState(2800);
  const [simCompB, setSimCompB] = useState(0);

  const loadData = useCallback(async () => {
    const [bRes, cRes] = await Promise.all([
      fetch(`/api/billing?month=${month}`, { cache: 'no-store' }),
      fetch('/api/catalog', { cache: 'no-store' }),
    ]);
    if (bRes.ok) {
      const data = await bRes.json();
      setStatements(data.statements ?? []);
      setReport(data.financialReport ?? null);
    }
    if (cRes.ok) {
      setOrgs((await cRes.json()).organizations ?? []);
    }
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTick]);

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? id;

  const handleRecalculate = async () => {
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'RECALCULATE', month }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi tính bảng kê');
    pushToast('success', `Đã đối soát lại toàn bộ bảng kê tháng ${month}`);
    triggerRefresh();
  };

  const handleConfirm = async (id: string) => {
    const res = await fetch(`/api/billing/${id}`, { method: 'PATCH' });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi xác nhận');
    pushToast('success', `Đã xác nhận bảng kê ${data.statement.code}`);
    triggerRefresh();
  };

  const customerSts = statements.filter((s) => s.statementType === 'KHACH_HANG');
  const partnerSts = statements.filter((s) => s.statementType === 'DOI_TAC');

  // Simulator calculation matching BR-12
  const simBillableKg = Math.max(simCommitTons, simDeliveredTons) * 1000;
  const simNet = Math.max(0, simPrice * simBillableKg - simCompB);

  const breakEvenChartData = report
    ? [
        { name: 'Sản lượng đạt BG5 (tấn)', value: report.actualTons },
        { name: 'Điểm hòa vốn (tấn)', value: report.breakEvenTons },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {tx(
              lang,
              'Tính cước Take-or-Pay & Đối soát tháng (M10)',
              'Take-or-Pay 課金計算・月次精算照合 (M10)'
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {tx(
              lang,
              'BR-12: Phí tháng = P × max(Q_ck, Q_đạt) - B. Dòng tiền 1 chiều qua Mitsui (không ghi nhận giá mua bán nông sản BR-16).',
              'BR-12: 月額料金 = P × max(Q_ck, Q_đạt) - B。Mitsui経由の一方向決済（農産物売買価格は記録しない BR-16）。'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium bg-white"
          />
          <button
            onClick={handleRecalculate}
            disabled={currentUser?.role !== 'QUAN_LY_QC'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Tính lại bảng kê (QC)
          </button>
        </div>
      </div>

      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Doanh thu khách hàng (ròng)"
            value={`${Math.round(report.totalRevenueVnd / 1_000_000).toLocaleString('vi-VN')} tr đ`}
            sub={`Sản lượng tính cước: ${report.billableTons} tấn`}
            tone="emerald"
          />
          <StatCard
            label="Chi phí trả đối tác"
            value={`${Math.round(report.totalPartnerCostVnd / 1_000_000).toLocaleString('vi-VN')} tr đ`}
            sub={`Biên đóng góp: ${report.contributionMarginPerKg.toLocaleString('vi-VN')} đ/kg`}
            tone="blue"
          />
          <StatCard
            label="Lợi nhuận vận hành"
            value={`${Math.round(report.operatingProfitVnd / 1_000_000).toLocaleString('vi-VN')} tr đ`}
            sub={`Sau ${Math.round(report.fixedOverheadVnd / 1_000_000)} tr chi phí cố định`}
            tone={report.operatingProfitVnd > 0 ? 'emerald' : 'rose'}
          />
          <StatCard
            label="Chi phí điều phối HT / kg (NFR-15)"
            value={`${report.coordCostPerKg.toLocaleString('vi-VN')} đ/kg`}
            sub={`Khung mục tiêu: ${report.coordCostTargetMin}–${report.coordCostTargetMax} đ/kg`}
            tone={report.coordCostPerKg <= report.coordCostTargetMax ? 'emerald' : 'amber'}
          />
        </div>
      )}

      {/* Customer Statements */}
      <Card
        title="Bảng kê Khách hàng B2B (Take-or-Pay BR-12)"
        subtitle="Áp dụng giảm trừ bồi hoàn theo phán quyết QC đã chốt trong tháng (FR-42)"
      >
        <ResponsiveTable
          data={customerSts}
          rowKey={(s) => s.id}
          columns={[
            {
              key: 'code',
              header: 'Mã bảng kê / Khách hàng',
              render: (s) => (
                <div>
                  <div className="font-mono text-xs font-bold text-slate-900">{s.code}</div>
                  <div className="text-xs text-slate-600">{orgName(s.orgId)}</div>
                </div>
              ),
            },
            {
              key: 'qty',
              header: 'Cam kết / Giao đạt BG5',
              render: (s) => (
                <div className="text-xs">
                  Cam kết: <strong>{((s.committedKg ?? 0) / 1000).toLocaleString('vi-VN')} tấn</strong>
                  <br />
                  Giao đạt: <strong>{((s.acceptedKg ?? 0) / 1000).toLocaleString('vi-VN')} tấn</strong>
                </div>
              ),
            },
            {
              key: 'bill',
              header: 'Tính cước / Đơn giá',
              render: (s) => (
                <div className="text-xs">
                  <strong>{s.billableKg.toLocaleString('vi-VN')} kg</strong> × {s.unitPriceVndPerKg.toLocaleString('vi-VN')} đ
                </div>
              ),
            },
            {
              key: 'net',
              header: 'Bồi hoàn / Phải thu ròng',
              render: (s) => (
                <div className="text-xs">
                  {s.deductionOrPenaltyVnd > 0 && (
                    <div className="text-rose-600">-{s.deductionOrPenaltyVnd.toLocaleString('vi-VN')} đ</div>
                  )}
                  <div className="font-bold text-emerald-700 text-sm">
                    {s.netAmountVnd.toLocaleString('vi-VN')} đ
                  </div>
                </div>
              ),
            },
            {
              key: 'actions',
              header: 'Xác nhận & Xuất file',
              render: (s) => (
                <div className="flex flex-wrap gap-1.5 justify-end md:justify-start">
                  <Badge tone={s.status === 'DA_XAC_NHAN' ? 'emerald' : 'amber'}>
                    {s.status === 'DA_XAC_NHAN' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                  </Badge>
                  {s.status !== 'DA_XAC_NHAN' && (
                    <button
                      onClick={() => handleConfirm(s.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Xác nhận
                    </button>
                  )}
                  <a
                    href={`/api/billing/export?statementId=${s.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV/Excel
                  </a>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Partner Statements */}
      <Card title="Bảng kê Chi phí Đối tác (FR-41, FR-42)">
        <ResponsiveTable
          data={partnerSts}
          rowKey={(s) => s.id}
          columns={[
            {
              key: 'code',
              header: 'Mã bảng kê / Đối tác',
              render: (s) => (
                <div>
                  <div className="font-mono text-xs font-bold text-slate-900">{s.code}</div>
                  <div className="text-xs text-slate-600">{orgName(s.orgId)}</div>
                </div>
              ),
            },
            {
              key: 'qty',
              header: 'Khối lượng BG / Đơn giá',
              render: (s) => (
                <span className="text-xs">
                  {s.billableKg.toLocaleString('vi-VN')} kg × {s.unitPriceVndPerKg.toLocaleString('vi-VN')} đ
                </span>
              ),
            },
            {
              key: 'net',
              header: 'Trừ phạt SLA / Thực trả',
              render: (s) => (
                <div className="text-xs">
                  {s.deductionOrPenaltyVnd > 0 && (
                    <div className="text-rose-600">-{s.deductionOrPenaltyVnd.toLocaleString('vi-VN')} đ</div>
                  )}
                  <div className="font-bold text-slate-900 text-sm">
                    {s.netAmountVnd.toLocaleString('vi-VN')} đ
                  </div>
                </div>
              ),
            },
            {
              key: 'export',
              header: 'Hạch toán',
              render: (s) => (
                <a
                  href={`/api/billing/export?statementId=${s.id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                >
                  <Download className="w-3.5 h-3.5" /> Xuất CSV
                </a>
              ),
            },
          ]}
        />
      </Card>

      {/* Break-even Chart & Take-or-Pay Formula Verifier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="So sánh Sản lượng tháng vs Điểm hòa vốn 400 tấn/tháng (FR-44)"
          subtitle={
            report?.breakEvenReached
              ? 'Đã vượt điểm hòa vốn 400 tấn/tháng!'
              : 'Chưa đạt điểm hòa vốn 400 tấn/tháng'
          }
        >
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakEvenChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis unit=" tấn" tick={{ fontSize: 11 }} />
                <Tooltip />
                <ReferenceLine y={400} stroke="#e11d48" strokeDasharray="4 4" label="400 tấn" />
                <Bar dataKey="value" fill="#059669" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          title="Máy tính kiểm chứng công thức Take-or-Pay (BR-12)"
          subtitle="Phí tháng = P × max(Q_ck, Q_đạt) - B"
        >
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-600 mb-1">Cam kết Q_ck (tấn)</label>
              <input
                type="number"
                value={simCommitTons}
                onChange={(e) => setSimCommitTons(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600 mb-1">Giao đạt Q_đạt (tấn)</label>
              <input
                type="number"
                value={simDeliveredTons}
                onChange={(e) => setSimDeliveredTons(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600 mb-1">Đơn giá P (đ/kg)</label>
              <input
                type="number"
                value={simPrice}
                onChange={(e) => setSimPrice(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600 mb-1">Bồi hoàn B (đ)</label>
              <input
                type="number"
                value={simCompB}
                onChange={(e) => setSimCompB(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-emerald-900">
              <Calculator className="w-4 h-4" />
              <span>
                Tính cước trên <strong>{(simBillableKg / 1000).toLocaleString('vi-VN')} tấn</strong>
              </span>
            </div>
            <div className="text-lg font-bold text-emerald-800">
              {simNet.toLocaleString('vi-VN')} đ
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
