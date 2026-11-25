'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Award, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { useCct } from '@/components/layout/CctContext';
import {
  displayOrgName,
  displayTempGroupName,
  localizeKpiMetric,
  tx,
} from '@/lib/i18n';
import { KpiDashboardData, PartnerScoreRecord } from '@/types/claim-billing-kpi';
import { Organization } from '@/types/common';
import { TempGroup } from '@/types/catalog';

export function KpiPanel() {
  const { refreshTick, pushToast, triggerRefresh, lang } = useCct();
  const [month, setMonth] = useState('2026-11');
  const [customerOrgId, setCustomerOrgId] = useState('');
  const [partnerOrgId, setPartnerOrgId] = useState('');
  const [tempGroupId, setTempGroupId] = useState('');

  const [kpiData, setKpiData] = useState<KpiDashboardData | null>(null);
  const [scores, setScores] = useState<PartnerScoreRecord[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [tempGroups, setTempGroups] = useState<TempGroup[]>([]);

  const loadData = useCallback(async () => {
    const qs = new URLSearchParams({ month });
    if (customerOrgId) qs.set('customerOrgId', customerOrgId);
    if (partnerOrgId) qs.set('partnerOrgId', partnerOrgId);
    if (tempGroupId) qs.set('tempGroupId', tempGroupId);

    const [kRes, cRes] = await Promise.all([
      fetch(`/api/kpi?${qs.toString()}`, { cache: 'no-store' }),
      fetch('/api/catalog', { cache: 'no-store' }),
    ]);
    if (kRes.ok) {
      const data = await kRes.json();
      setKpiData(data.kpiData);
      setScores(data.partnerScores ?? []);
    }
    if (cRes.ok) {
      const cat = await cRes.json();
      setOrgs(cat.organizations ?? []);
      setTempGroups(cat.tempGroups ?? []);
    }
  }, [month, customerOrgId, partnerOrgId, tempGroupId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTick]);

  const orgName = (id: string) => displayOrgName(orgs.find((o) => o.id === id)?.name ?? id, lang);

  const handleRecalcScores = async () => {
    const res = await fetch('/api/kpi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return pushToast(
        'error',
        err.error || tx(lang, 'Không có quyền chấm điểm đối tác', 'パートナー再採点の権限がありません')
      );
    }
    pushToast(
      'success',
      tx(lang, `Đã chấm điểm lại đối tác tháng ${month} (BR-14)`, `${month} のパートナー評価を再採点しました (BR-14)`)
    );
    triggerRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {tx(
              lang,
              'Dashboard 8 KPI Thí Điểm & Chấm điểm Đối tác (M11)',
              'パイロット8 KPI ダッシュボード・パートナー評価 (M11)'
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {tx(
              lang,
              'Tính động từ dữ liệu vận hành thực tế (Mục 9.1). Chỉ tiêu dưới ngưỡng được tô đỏ; đối tác < 70 điểm 2 tháng liên tiếp gắn cờ Rà soát hợp đồng (BR-14).',
              '実運用データから動的算出。基準未満は赤表示、2ヶ月連続70点未満のパートナーは契約見直し対象 (BR-14)。'
            )}
          </p>
        </div>
        <button
          onClick={handleRecalcScores}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {tx(lang, 'Chấm điểm đối tác', 'パートナー再採点')}
        </button>
      </div>

      {/* Filters (FR-45) */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {tx(lang, 'Tháng đánh giá', '評価対象月')}
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {tx(lang, 'Lọc theo Khách hàng', '顧客で絞り込み')}
            </label>
            <select
              value={customerOrgId}
              onChange={(e) => setCustomerOrgId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">{tx(lang, 'Tất cả khách hàng', 'すべての顧客')}</option>
              {orgs
                .filter((o) => o.type === 'KHACH_HANG')
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {displayOrgName(o.name, lang)}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {tx(lang, 'Lọc theo Đối tác', 'パートナーで絞り込み')}
            </label>
            <select
              value={partnerOrgId}
              onChange={(e) => setPartnerOrgId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">{tx(lang, 'Tất cả đối tác', 'すべてのパートナー')}</option>
              {orgs
                .filter((o) => ['CO_SO_SO_CHE', 'KHO_LANH', 'NHA_VAN_TAI'].includes(o.type))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {displayOrgName(o.name, lang)}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {tx(lang, 'Lọc theo Nhóm nhiệt', '温度帯で絞り込み')}
            </label>
            <select
              value={tempGroupId}
              onChange={(e) => setTempGroupId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">{tx(lang, 'Tất cả nhóm nhiệt', 'すべての温度帯')}</option>
              {tempGroups.map((t) => (
                <option key={t.id} value={t.id}>
                  {displayTempGroupName(t.name, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* 8 Pilot KPIs Grid */}
      {kpiData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {kpiData.metrics.map((rawMetric) => {
            const m = localizeKpiMetric(rawMetric, lang);
            return (
              <div
                key={m.key}
                className={`rounded-2xl border p-4 shadow-sm transition ${
                  m.passed ? 'border-emerald-200 bg-white' : 'border-rose-300 bg-rose-50/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {m.group}
                  </span>
                  <Badge tone={m.passed ? 'emerald' : 'rose'}>
                    {m.passed ? tx(lang, 'Đạt ngưỡng', '基準達成') : tx(lang, 'Dưới ngưỡng', '基準未達')}
                  </Badge>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1.5">{m.label}</div>
                <div
                  className={`text-2xl font-bold mt-2 ${
                    m.passed ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {m.actualValue} {m.unit}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {tx(lang, 'Mục tiêu:', '目標:')} <strong>{m.targetLabel}</strong>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{m.formulaNote}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Partner Monthly Scoring Table (BR-14) */}
      <Card
        title={tx(
          lang,
          'Bảng chấm điểm đối tác hằng tháng — Thang 100 (FR-46, BR-14)',
          '月次パートナー評価スコア表 — 100点満点 (FR-46, BR-14)'
        )}
        subtitle={tx(
          lang,
          'Trọng số: Đúng hạn 30% + Giữ dải nhiệt 30% + Dung sai khối lượng 20% + Khiếu nại 20%',
          '配点ウェイト: 定時順守 30% + 温度帯維持 30% + 重量許容差 20% + 無クレーム率 20%'
        )}
      >
        <ResponsiveTable
          data={scores}
          rowKey={(s) => s.id}
          columns={[
            {
              key: 'month',
              header: tx(lang, 'Kỳ / Đối tác', '対象月 / パートナー'),
              render: (s) => (
                <div>
                  <div className="font-mono text-xs font-bold text-slate-500">{s.month}</div>
                  <div className="text-xs font-semibold text-slate-900">{orgName(s.partnerOrgId)}</div>
                </div>
              ),
            },
            {
              key: 'otd',
              header: tx(lang, 'Đúng hạn (30%)', '定時性 (30%)'),
              render: (s) => <span className="text-xs">{s.onTimeRatePct}%</span>,
            },
            {
              key: 'temp',
              header: tx(lang, 'Dải nhiệt (30%)', '温度順守 (30%)'),
              render: (s) => <span className="text-xs">{s.tempCompliancePct}%</span>,
            },
            {
              key: 'wt',
              header: tx(lang, 'Khối lượng (20%)', '重量精度 (20%)'),
              render: (s) => <span className="text-xs">{s.weightCompliancePct}%</span>,
            },
            {
              key: 'clm',
              header: tx(lang, 'Không lỗi KN (20%)', '無クレーム (20%)'),
              render: (s) => <span className="text-xs">{s.claimFreeScorePct}%</span>,
            },
            {
              key: 'total',
              header: tx(lang, 'Tổng điểm / Cảnh báo', '総合点 / 契約警告'),
              render: (s) => (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 font-bold text-sm ${
                      s.totalScore < 70 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    <Award className="w-4 h-4" /> {s.totalScore}/100
                  </span>
                  {s.contractReviewFlag && (
                    <Badge tone="rose">
                      <AlertTriangle className="w-3 h-3" />{' '}
                      {tx(
                        lang,
                        'Diện rà soát hợp đồng (<70đ × 2 tháng)',
                        '契約見直し対象 (<70点×2ヶ月連続)'
                      )}
                    </Badge>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
