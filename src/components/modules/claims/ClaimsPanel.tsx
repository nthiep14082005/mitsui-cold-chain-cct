'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Gavel, Lock, MessageSquare, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, ClaimStatusBadge } from '@/components/ui/Badge';
import { useCct } from '@/components/layout/CctContext';
import {
  displayOperationalText,
  displayOrgName,
  formatDateTime,
  formatNum,
  formatVnd,
  PARTY_TYPE_I18N,
  tx,
} from '@/lib/i18n';
import { Claim } from '@/types/claim-billing-kpi';
import { Organization } from '@/types/common';

interface EnrichedClaim extends Claim {
  lotCode: string;
}

export function ClaimsPanel() {
  const { refreshTick, pushToast, triggerRefresh, currentUser, lang } = useCct();
  const [claims, setClaims] = useState<EnrichedClaim[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedId, setSelectedId] = useState('');

  const [partyType, setPartyType] = useState<'DOI_TAC' | 'NGUON_HANG' | 'SAU_BAN_GIAO' | 'MITSUI'>('DOI_TAC');
  const [respOrgId, setRespOrgId] = useState('');
  const [compKg, setCompKg] = useState(0);
  const [compVnd, setCompVnd] = useState(0);
  const [penaltyVnd, setPenaltyVnd] = useState(0);
  const [reason, setReason] = useState('');

  const loadData = useCallback(async () => {
    const [cRes, catRes] = await Promise.all([
      fetch('/api/claims', { cache: 'no-store' }),
      fetch('/api/catalog', { cache: 'no-store' }),
    ]);
    if (cRes.ok) {
      const data = await cRes.json();
      const list: EnrichedClaim[] = data.claims ?? [];
      setClaims(list);
      if (!selectedId && list[0]) {
        setSelectedId(list[0].id);
        setRespOrgId(list[0].systemSuggestedOrgId ?? '');
        setCompKg(list[0].affectedKg);
        setCompVnd(list[0].affectedKg * 18000);
        setPenaltyVnd(list[0].affectedKg * 8000);
      }
    }
    if (catRes.ok) {
      setOrgs((await catRes.json()).organizations ?? []);
    }
  }, [selectedId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTick]);

  const selected = claims.find((c) => c.id === selectedId) ?? claims[0];
  const orgName = (id?: string) =>
    id ? displayOrgName(orgs.find((o) => o.id === id)?.name ?? id, lang) : '—';

  const handleSelectClaim = (c: EnrichedClaim) => {
    setSelectedId(c.id);
    setRespOrgId(c.systemSuggestedOrgId ?? '');
    setCompKg(c.affectedKg);
    setCompVnd(c.affectedKg * 18000);
    setPenaltyVnd(c.affectedKg * 8000);
    setReason('');
  };

  const handleAdjudicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const res = await fetch(`/api/claims/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ADJUDICATE',
        responsiblePartyType: partyType,
        responsibleOrgId: partyType === 'DOI_TAC' ? respOrgId : undefined,
        compensatedKg: Number(compKg),
        customerCompensationVnd: Number(compVnd),
        partnerPenaltyVnd: Number(penaltyVnd),
        reason,
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi ra phán quyết', '裁定登録エラー'));
    pushToast(
      'success',
      tx(
        lang,
        `Đã chốt phán quyết ${selected.code} và cập nhật bảng kê tháng (BR-13)`,
        `裁定 ${selected.code} を確定し、月次精算書に反映しました (BR-13)`
      )
    );
    triggerRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          {tx(
            lang,
            'Xử lý Khiếu nại & Phân định trách nhiệm (M9 · BR-10, BR-13)',
            'クレーム対応・責任分界裁定 (M9 · BR-10, BR-13)'
          )}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          {tx(
            lang,
            'Hệ thống tự dựng hồ sơ lô & đề xuất khâu nghi lỗi theo thứ tự ưu tiên (a)→(b)→(c)→(d). Phán quyết QC là bất biến (NFR-06).',
            'システムがロット履歴から推定原因工程を (a)→(b)→(c)→(d) の優先順で自動提示。QC裁定は変更不可 (NFR-06)。'
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 space-y-2.5">
          {claims.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelectClaim(c)}
              className={`w-full text-left p-3.5 rounded-xl border transition ${
                selected?.id === c.id
                  ? 'border-emerald-500 bg-emerald-50/50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-slate-900">{c.code}</span>
                <ClaimStatusBadge status={c.status} />
              </div>
              <div className="text-xs font-medium text-slate-700 mt-1">
                {tx(lang, 'Lô', 'ロット')} {c.lotCode} · {orgName(c.customerOrgId)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {tx(lang, 'Ảnh hưởng:', '影響重量:')} <strong>{formatNum(c.affectedKg, lang)} kg</strong>
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-8 space-y-4">
          {selected && (
            <Card
              title={tx(
                lang,
                `Hồ sơ khiếu nại ${selected.code} — Lô ${selected.lotCode}`,
                `クレーム案件 ${selected.code} — ロット ${selected.lotCode}`
              )}
              subtitle={tx(
                lang,
                `Khách hàng: ${orgName(selected.customerOrgId)} · Khối lượng ảnh hưởng: ${selected.affectedKg} kg`,
                `顧客: ${orgName(selected.customerOrgId)} · 対象重量: ${formatNum(selected.affectedKg, lang)} kg`
              )}
            >
              <div className="space-y-4">
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {displayOperationalText(selected.description, lang)}
                </p>

                {/* BR-10 Automated Suggestion */}
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <ShieldAlert className="w-4 h-4 text-amber-700" />
                    {tx(
                      lang,
                      `Hệ thống tự động khoanh vùng & đề xuất khâu lỗi (${selected.systemSuggestionRule})`,
                      `システム自動分析・推定原因工程 (${selected.systemSuggestionRule})`
                    )}
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    {displayOperationalText(selected.systemSuggestionDetail, lang)}
                  </p>
                  <div className="text-[11px] text-amber-700">
                    {tx(
                      lang,
                      'Đề xuất không ràng buộc; phán quyết cuối cùng do Quản lý / QC Mitsui quyết định.',
                      '※上記は参考提案であり、最終裁定は Mitsui マネージャー / QC が決定します。'
                    )}
                  </div>
                </div>

                {/* Partner 48h Explanation */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    {tx(lang, 'Giải trình của đối tác (Hạn 48h — FR-39)', 'パートナー弁明書（提出期限 48時間 — FR-39）')}
                  </div>
                  {selected.partnerExplanation ? (
                    <div className="text-xs text-slate-700 space-y-1">
                      <p>{displayOperationalText(selected.partnerExplanation.content, lang)}</p>
                      <p className="text-[11px] text-slate-400">
                        {tx(lang, 'Gửi lúc', '提出日時')}{' '}
                        {formatDateTime(selected.partnerExplanation.submittedAt, lang)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {tx(
                        lang,
                        `Chưa nhận được giải trình từ ${orgName(selected.systemSuggestedOrgId)}.`,
                        `${orgName(selected.systemSuggestedOrgId)} からの弁明はまだ提出されていません。`
                      )}
                    </p>
                  )}
                </div>

                {/* Decision or Adjudication Form */}
                {selected.decision ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <Lock className="w-4 h-4" />{' '}
                        {tx(lang, 'Phán quyết QC đã chốt (Bất biến - NFR-06)', 'QC裁定確定済（改変不可 - NFR-06）')}
                      </span>
                      <Badge tone="emerald">
                        {tx(lang, 'Đã ghi vào bảng kê tháng', '月次精算書へ反映済')}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-emerald-900">
                      <div>
                        {tx(lang, 'Bên chịu lỗi:', '責任帰属:')}{' '}
                        <strong>
                          {selected.decision.responsibleOrgId
                            ? orgName(selected.decision.responsibleOrgId)
                            : PARTY_TYPE_I18N[selected.decision.responsiblePartyType]?.[lang] ??
                              selected.decision.responsiblePartyType}
                        </strong>
                      </div>
                      <div>
                        {tx(lang, 'Bồi hoàn khách:', '顧客補償:')}{' '}
                        <strong>{formatVnd(selected.decision.customerCompensationVnd, lang)}</strong>
                      </div>
                      <div>
                        {tx(lang, 'Phạt SLA đối tác:', 'パートナーSLA違約金:')}{' '}
                        <strong>{formatVnd(selected.decision.partnerPenaltyVnd, lang)}</strong>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-800">
                      {tx(lang, 'Lý do:', '裁定理由:')}{' '}
                      {displayOperationalText(selected.decision.reason, lang)}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleAdjudicate} className="p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Gavel className="w-4 h-4 text-emerald-600" />{' '}
                        {tx(lang, 'Ra phán quyết cuối cùng (Quản lý / QC)', '最終裁定登録（マネージャー / QC）')}
                      </h4>
                      {currentUser?.role !== 'QUAN_LY_QC' && (
                        <Badge tone="amber">
                          {tx(lang, 'Cần vai trò Quản lý / QC để chốt', '確定にはマネージャー / QC権限が必要')}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          {tx(lang, 'Bên chịu trách nhiệm', '責任帰属先')}
                        </label>
                        <select
                          value={partyType}
                          onChange={(e) => setPartyType(e.target.value as typeof partyType)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="DOI_TAC">{PARTY_TYPE_I18N.DOI_TAC[lang]}</option>
                          <option value="NGUON_HANG">{PARTY_TYPE_I18N.NGUON_HANG[lang]}</option>
                          <option value="SAU_BAN_GIAO">{PARTY_TYPE_I18N.SAU_BAN_GIAO[lang]}</option>
                          <option value="MITSUI">{PARTY_TYPE_I18N.MITSUI[lang]}</option>
                        </select>
                      </div>
                      {partyType === 'DOI_TAC' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            {tx(lang, 'Đối tác bị phạt SLA', 'SLA違約金対象パートナー')}
                          </label>
                          <select
                            value={respOrgId}
                            onChange={(e) => setRespOrgId(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          >
                            {orgs
                              .filter((o) => ['CO_SO_SO_CHE', 'KHO_LANH', 'NHA_VAN_TAI'].includes(o.type))
                              .map((o) => (
                                <option key={o.id} value={o.id}>
                                  {displayOrgName(o.name, lang)}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          {tx(lang, 'Bồi hoàn khách (VNĐ)', '顧客補償額 (VND)')}
                        </label>
                        <input
                          type="number"
                          value={compVnd}
                          onChange={(e) => setCompVnd(Number(e.target.value))}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          {tx(lang, 'Phạt đối tác theo SLA (VNĐ)', 'パートナーSLA違約金 (VND)')}
                        </label>
                        <input
                          type="number"
                          value={penaltyVnd}
                          onChange={(e) => setPenaltyVnd(Number(e.target.value))}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {tx(lang, 'Lý do phán quyết (bắt buộc)', '裁定理由（必須）')}
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        placeholder={tx(
                          lang,
                          'Ghi rõ căn cứ biên bản bàn giao và dữ liệu nhiệt độ...',
                          '引渡記録および温度データの根拠を明記してください...'
                        )}
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                        required
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={currentUser?.role !== 'QUAN_LY_QC'}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40"
                      >
                        {tx(lang, 'Chốt phán quyết & Cập nhật bảng kê', '裁定を確定して精算書に反映')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
