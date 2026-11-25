'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, OrgTypeBadge } from '@/components/ui/Badge';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { useCct } from '@/components/layout/CctContext';
import {
  AUDIT_ACTION_I18N,
  displayOperationalText,
  displayOrgName,
  displayPackagingSpec,
  displayPlace,
  displayProductName,
  displayTempGroupName,
  displayUserName,
  formatDateTime,
  ROLE_LABELS_I18N,
  t,
  tx,
} from '@/lib/i18n';
import { AuditLog, Organization, SystemConfig, User } from '@/types/common';
import { Product, TempGroup, Vehicle } from '@/types/catalog';

export function AdminPanel() {
  const { refreshTick, pushToast, triggerRefresh, currentUser, lang } = useCct();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tempGroups, setTempGroups] = useState<TempGroup[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // Quick Add Product Form (NFR-13 extensible by config)
  const [newProdCode, setNewProdCode] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdTg, setNewProdTg] = useState('TG-LANH');
  const [newProdBuffer, setNewProdBuffer] = useState(10);

  const loadData = useCallback(async () => {
    const [aRes, cRes] = await Promise.all([
      fetch('/api/admin', { cache: 'no-store' }),
      fetch('/api/catalog', { cache: 'no-store' }),
    ]);
    if (aRes.ok) {
      const aData = await aRes.json();
      setConfig(aData.systemConfig);
      setAuditLogs(aData.auditLogs ?? []);
    }
    if (cRes.ok) {
      const cat = await cRes.json();
      setOrgs(cat.organizations ?? []);
      setUsers(cat.users ?? []);
      setProducts(cat.products ?? []);
      setTempGroups(cat.tempGroups ?? []);
      setVehicles(cat.vehicles ?? []);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTick]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    const res = await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UPDATE_CONFIG', systemConfig: config }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi lưu cấu hình', '設定保存エラー'));
    pushToast(
      'success',
      tx(lang, 'Đã lưu tham số vận hành hệ thống (FR-52)', '運用パラメータを保存しました (FR-52)')
    );
    triggerRefresh();
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'product',
        data: {
          code: newProdCode,
          name: newProdName,
          tempGroupId: newProdTg,
          packagingSpec: '10 kg/thùng carton',
          shrinkageBufferPct: Number(newProdBuffer),
          unit: 'kg',
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi thêm mặt hàng', '品目追加エラー'));
    pushToast(
      'success',
      tx(lang, `Đã thêm mặt hàng ${newProdName}`, `品目「${newProdName}」を追加しました`)
    );
    setNewProdCode('');
    setNewProdName('');
    triggerRefresh();
  };

  const handleResetDemo = async () => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'RESET_DEMO' }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Không có quyền Reset Demo', 'デモ初期化権限がありません'));
    pushToast(
      'success',
      tx(lang, 'Đã khôi phục dữ liệu mẫu thành công!', 'デモデータを初期状態に復元しました！')
    );
    triggerRefresh();
  };

  const isAdmin = currentUser?.role === 'QUAN_TRI_HE_THONG';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {tx(
              lang,
              'Danh mục, Cấu hình Tham số & Nhật ký Audit (M1, M13)',
              'マスタ管理・運用パラメータ設定・監査ログ (M1, M13)'
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {tx(
              lang,
              'Quản trị hệ thống quản lý danh mục & tham số; không được sửa dữ liệu vận hành hay ePOD (NFR-06).',
              'システム管理者はマスタと設定のみ管理し、確定済のePOD・温度データ・裁定は改変不可です (NFR-06)。'
            )}
          </p>
        </div>
        <button
          onClick={handleResetDemo}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
        >
          <RotateCcw className="w-4 h-4" /> {t('resetDemo', lang)}
        </button>
      </div>

      {/* Dynamic System Config (FR-52) */}
      {config && (
        <Card
          title={tx(lang, 'Tham số vận hành động (FR-52)', '動的運用パラメータ設定 (FR-52)')}
          subtitle={
            isAdmin
              ? tx(
                  lang,
                  'Bạn đang đăng nhập với quyền Quản trị hệ thống — có thể cập nhật tham số.',
                  'システム管理者としてログイン中 — 運用パラメータを更新できます。'
                )
              : tx(
                  lang,
                  'Chuyển sang vai trò Quản trị hệ thống để chỉnh sửa tham số.',
                  'パラメータを変更するにはシステム管理者ロールへ切り替えてください。'
                )
          }
        >
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  {tx(lang, 'Giờ chốt đơn D-1', 'D-1 注文締切時刻')}
                </label>
                <input
                  type="number"
                  value={config.cutoffHour}
                  onChange={(e) => setConfig({ ...config, cutoffHour: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  {tx(lang, 'Vượt ngưỡng (phút)', '温度逸脱閾値 (分)')}
                </label>
                <input
                  type="number"
                  value={config.tempAlertMinutes}
                  onChange={(e) =>
                    setConfig({ ...config, tempAlertMinutes: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  {tx(lang, 'Mất sóng (phút)', '通信途絶閾値 (分)')}
                </label>
                <input
                  type="number"
                  value={config.signalLossMinutes}
                  onChange={(e) =>
                    setConfig({ ...config, signalLossMinutes: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  {tx(lang, 'Dung sai KL (%)', '重量許容差 (%)')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={config.weightTolerancePct}
                  onChange={(e) =>
                    setConfig({ ...config, weightTolerancePct: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  {tx(lang, 'Cửa sổ KN (giờ)', 'クレーム期限 (時間)')}
                </label>
                <input
                  type="number"
                  value={config.claimWindowHours}
                  onChange={(e) =>
                    setConfig({ ...config, claimWindowHours: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  {tx(lang, 'Cảnh báo lưu kho (%)', '保管期限警告 (%)')}
                </label>
                <input
                  type="number"
                  value={config.storageWarningPct}
                  onChange={(e) =>
                    setConfig({ ...config, storageWarningPct: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!isAdmin}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40"
              >
                <Save className="w-3.5 h-3.5" />{' '}
                {tx(lang, 'Lưu tham số cấu hình', '設定パラメータを保存')}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Catalog Summary + Add Product */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title={tx(
            lang,
            `Danh mục Mặt hàng (${products.length}) & Nhóm nhiệt (${tempGroups.length})`,
            `品目マスタ (${products.length}) & 温度帯マスタ (${tempGroups.length})`
          )}
        >
          <div className="space-y-2 mb-4">
            {products.map((p) => {
              const tg = tempGroups.find((t) => t.id === p.tempGroupId);
              return (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-700 mr-2">{p.code}</span>
                    <strong className="text-slate-900">{displayProductName(p.name, lang)}</strong>
                    <div className="text-[11px] text-slate-500">
                      {displayPackagingSpec(p.packagingSpec, lang)} ·{' '}
                      {tx(lang, 'Hao hụt dự phòng:', '歩留まり予備係数:')} {p.shrinkageBufferPct}%
                    </div>
                  </div>
                  <Badge tone={tg?.code === 'LANH' ? 'blue' : 'amber'}>
                    {displayTempGroupName(tg?.name ?? p.tempGroupId, lang)}
                  </Badge>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleAddProduct} className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="text-xs font-bold text-slate-700">
              {tx(lang, 'Thêm mặt hàng mới (FR-02, NFR-13)', '新規品目を追加 (FR-02, NFR-13)')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newProdCode}
                onChange={(e) => setNewProdCode(e.target.value)}
                placeholder={tx(lang, 'Mã (VD: DC-01)', '品目コード (例: DC-01)')}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                required
              />
              <input
                type="text"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder={tx(lang, 'Tên mặt hàng', '品目名')}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                required
              />
              <select
                value={newProdTg}
                onChange={(e) => setNewProdTg(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
              >
                {tempGroups.map((t) => (
                  <option key={t.id} value={t.id}>
                    {displayTempGroupName(t.name, lang)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={newProdBuffer}
                onChange={(e) => setNewProdBuffer(Number(e.target.value))}
                placeholder={tx(lang, 'Hao hụt %', '予備係数 %')}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={!isAdmin}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-40"
            >
              + {tx(lang, 'Thêm mặt hàng', '品目を追加')}
            </button>
          </form>
        </Card>

        <Card
          title={tx(
            lang,
            `Tổ chức (${orgs.length}) · Tài khoản (${users.length}) · Xe (${vehicles.length})`,
            `組織 (${orgs.length}) · アカウント (${users.length}) · 車両 (${vehicles.length})`
          )}
        >
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {orgs.map((o) => (
              <div
                key={o.id}
                className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900">{displayOrgName(o.name, lang)}</div>
                  <div className="text-[11px] text-slate-500">
                    {tx(lang, 'MST:', '法人税番号:')} {o.taxCode} · {displayPlace(o.province, lang)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <OrgTypeBadge orgType={o.type} />
                  {o.type === 'NHA_CUNG_CAP' && (
                    <Badge tone={o.allowPublicName ? 'emerald' : 'rose'}>
                      QR:{' '}
                      {o.allowPublicName
                        ? tx(lang, 'Công khai tên', '名称公開')
                        : tx(lang, 'Ẩn tên HTX', '農協名非公開')}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Audit Log (FR-53) */}
      <Card
        title={tx(lang, 'Nhật ký kiểm toán hệ thống (Audit Log — FR-53)', 'システム監査ログ (Audit Log — FR-53)')}
        subtitle={tx(
          lang,
          'Ghi nhận mọi thao tác tạo, sửa, xác nhận và phán quyết kèm giá trị trước/sau',
          'すべての作成・更新・承認・裁定操作を変更前後データとともに記録します'
        )}
      >
        <ResponsiveTable
          data={auditLogs.slice(0, 25)}
          rowKey={(a) => a.id}
          columns={[
            {
              key: 'time',
              header: tx(lang, 'Thời gian', '日時'),
              render: (a) => (
                <span className="text-xs text-slate-500">{formatDateTime(a.timestamp, lang)}</span>
              ),
            },
            {
              key: 'actor',
              header: tx(lang, 'Người thực hiện', '実行者'),
              render: (a) => (
                <div className="text-xs">
                  <strong>{displayUserName(a.actorName, lang)}</strong>
                  <div className="text-[11px] font-mono text-slate-400">
                    {ROLE_LABELS_I18N[a.actorRole]?.[lang] ?? a.actorRole}
                  </div>
                </div>
              ),
            },
            {
              key: 'action',
              header: tx(lang, 'Hành động', '操作種別'),
              render: (a) => (
                <Badge tone="blue">
                  <ShieldCheck className="w-3 h-3" />{' '}
                  {AUDIT_ACTION_I18N[a.action]?.[lang] ?? a.action}
                </Badge>
              ),
            },
            {
              key: 'summary',
              header: tx(lang, 'Chi tiết', '詳細'),
              render: (a) => (
                <span className="text-xs text-slate-700">
                  {displayOperationalText(a.summary, lang)}
                </span>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
