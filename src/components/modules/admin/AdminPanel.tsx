'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { useCct } from '@/components/layout/CctContext';
import { AuditLog, Organization, SystemConfig, User } from '@/types/common';
import { Product, TempGroup, Vehicle } from '@/types/catalog';

export function AdminPanel() {
  const { refreshTick, pushToast, triggerRefresh, currentUser } = useCct();
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
  const [newProdSpec, setNewProdSpec] = useState('10 kg/thùng carton');
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
    if (!res.ok) return pushToast('error', data.error || 'Lỗi lưu cấu hình');
    pushToast('success', 'Đã lưu tham số vận hành hệ thống (FR-52)');
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
          packagingSpec: newProdSpec,
          shrinkageBufferPct: Number(newProdBuffer),
          unit: 'kg',
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi thêm mặt hàng');
    pushToast('success', `Đã thêm mặt hàng ${newProdName}`);
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
    if (!res.ok) return pushToast('error', data.error || 'Không có quyền Reset Demo');
    pushToast('success', data.message || 'Đã khôi phục dữ liệu mẫu');
    triggerRefresh();
  };

  const isAdmin = currentUser?.role === 'QUAN_TRI_HE_THONG';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Danh mục, Cấu hình Tham số & Nhật ký Audit (M1, M13)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Quản trị hệ thống quản lý danh mục & tham số [GĐ]; không được sửa dữ liệu vận hành hay ePOD (NFR-06).
          </p>
        </div>
        <button
          onClick={handleResetDemo}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
        >
          <RotateCcw className="w-4 h-4" /> Khôi phục dữ liệu mẫu (Reset Demo)
        </button>
      </div>

      {/* Dynamic System Config (FR-52) */}
      {config && (
        <Card
          title="Tham số vận hành động (FR-52)"
          subtitle={
            isAdmin
              ? 'Bạn đang đăng nhập với quyền Quản trị hệ thống — có thể cập nhật tham số.'
              : 'Chuyển sang vai trò Quản trị hệ thống để chỉnh sửa tham số.'
          }
        >
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-600 mb-1">Giờ chốt đơn D-1</label>
                <input
                  type="number"
                  value={config.cutoffHour}
                  onChange={(e) => setConfig({ ...config, cutoffHour: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Vượt ngưỡng (phút)</label>
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
                <label className="block font-medium text-slate-600 mb-1">Mất sóng (phút)</label>
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
                <label className="block font-medium text-slate-600 mb-1">Dung sai KL (%)</label>
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
                <label className="block font-medium text-slate-600 mb-1">Cửa sổ KN (giờ)</label>
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
                <label className="block font-medium text-slate-600 mb-1">Cảnh báo lưu kho (%)</label>
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
                <Save className="w-3.5 h-3.5" /> Lưu tham số cấu hình
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Catalog Summary + Add Product */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={`Danh mục Mặt hàng (${products.length}) & Nhóm nhiệt (${tempGroups.length})`}>
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
                    <strong className="text-slate-900">{p.name}</strong>
                    <div className="text-[11px] text-slate-500">
                      {p.packagingSpec} · Hao hụt dự phòng: {p.shrinkageBufferPct}%
                    </div>
                  </div>
                  <Badge tone={tg?.code === 'LANH' ? 'blue' : 'amber'}>{tg?.name}</Badge>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleAddProduct} className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="text-xs font-bold text-slate-700">Thêm mặt hàng mới (FR-02, NFR-13)</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newProdCode}
                onChange={(e) => setNewProdCode(e.target.value)}
                placeholder="Mã (VD: DC-01)"
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                required
              />
              <input
                type="text"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="Tên mặt hàng"
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
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={newProdBuffer}
                onChange={(e) => setNewProdBuffer(Number(e.target.value))}
                placeholder="Hao hụt %"
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={!isAdmin}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-40"
            >
              + Thêm mặt hàng
            </button>
          </form>
        </Card>

        <Card title={`Tổ chức (${orgs.length}) · Tài khoản (${users.length}) · Xe (${vehicles.length})`}>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {orgs.map((o) => (
              <div
                key={o.id}
                className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900">{o.name}</div>
                  <div className="text-[11px] text-slate-500">
                    MST: {o.taxCode} · {o.province}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone="slate">{o.type}</Badge>
                  {o.type === 'NHA_CUNG_CAP' && (
                    <Badge tone={o.allowPublicName ? 'emerald' : 'rose'}>
                      QR: {o.allowPublicName ? 'Công khai tên' : 'Ẩn tên HTX'}
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
        title="Nhật ký kiểm toán hệ thống (Audit Log — FR-53)"
        subtitle="Ghi nhận mọi thao tác tạo, sửa, xác nhận và phán quyết kèm giá trị trước/sau"
      >
        <ResponsiveTable
          data={auditLogs.slice(0, 25)}
          rowKey={(a) => a.id}
          columns={[
            {
              key: 'time',
              header: 'Thời gian',
              render: (a) => (
                <span className="text-xs text-slate-500">
                  {new Date(a.timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                </span>
              ),
            },
            {
              key: 'actor',
              header: 'Người thực hiện',
              render: (a) => (
                <div className="text-xs">
                  <strong>{a.actorName}</strong>
                  <div className="text-[11px] font-mono text-slate-400">{a.actorRole}</div>
                </div>
              ),
            },
            {
              key: 'action',
              header: 'Hành động',
              render: (a) => (
                <Badge tone="blue">
                  <ShieldCheck className="w-3 h-3" /> {a.action}
                </Badge>
              ),
            },
            {
              key: 'summary',
              header: 'Chi tiết',
              render: (a) => <span className="text-xs text-slate-700">{a.summary}</span>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
