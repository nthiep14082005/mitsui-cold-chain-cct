'use client';

import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Snowflake } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useCct } from '@/components/layout/CctContext';
import {
  displayOrgName,
  displayPlace,
  displayProductName,
  displayTempGroupName,
  formatNum,
  formatTime,
  tx,
} from '@/lib/i18n';
import { Organization } from '@/types/common';
import { Lot } from '@/types/lot-epod';
import { Product, TempGroup } from '@/types/catalog';

interface FefoInfo {
  lotId: string;
  hoursStored: number;
  maxStorageHours: number;
  usagePct: number;
  isWarning: boolean;
  remainingHours: number;
}

export function WarehousePanel({
  organizations,
  lots,
  products,
  tempGroups,
  fefoQueue,
}: {
  organizations: Organization[];
  lots: Lot[];
  products: Product[];
  tempGroups: TempGroup[];
  fefoQueue: FefoInfo[];
}) {
  const { pushToast, triggerRefresh, lang } = useCct();
  const [syncingLotId, setSyncingLotId] = useState<string | null>(null);

  const warehouses = organizations.filter((o) => o.type === 'KHO_LANH');
  const warehouseLots = lots.filter((l) => l.status === 'TRONG_KHO' && l.currentKg > 0);
  const prodName = (id: string) => displayProductName(products.find((p) => p.id === id)?.name ?? id, lang);
  const tgName = (id: string) => displayTempGroupName(tempGroups.find((t) => t.id === id)?.name ?? id, lang);

  const handleWmsSync = async (lotId: string) => {
    setSyncingLotId(lotId);
    const res = await fetch(`/api/lots/${lotId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'WMS_SYNC' }),
    });
    setSyncingLotId(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return pushToast('error', err.error || tx(lang, 'Đồng bộ WMS thất bại', 'WMS同期に失敗しました'));
    }
    pushToast(
      'success',
      tx(lang, 'Đã đồng bộ vị trí & tồn kho với API WMS (FR-21)', 'WMS APIと保管位置・在庫を同期しました (FR-21)')
    );
    triggerRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Warehouse Chambers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {warehouses.map((wh) => (
          <Card
            key={wh.id}
            title={displayOrgName(wh.name, lang)}
            subtitle={displayPlace(wh.address, lang)}
          >
            <div className="space-y-2.5">
              {(wh.chambers ?? []).map((ch) => {
                const inChamber = warehouseLots.filter((l) => l.chamberId === ch.id);
                const loadKg = inChamber.reduce((s, l) => s + l.currentKg, 0);
                const pct = Math.round((loadKg / ch.capacityKg) * 100);
                return (
                  <div
                    key={ch.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <Snowflake className="w-4 h-4 text-blue-600" />
                        {displayPlace(ch.name, lang)}
                      </div>
                      <Badge tone={ch.tempGroupId === 'TG-LANH' ? 'blue' : 'amber'}>
                        {tgName(ch.tempGroupId)}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>
                        {tx(lang, 'Tồn hiện tại:', '現在庫:')}{' '}
                        <strong>{formatNum(loadKg, lang)} kg</strong> / {formatNum(ch.capacityKg, lang)} kg
                      </span>
                      <span>
                        {inChamber.length} {tx(lang, 'lô', 'ロット')} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* FEFO Inventory Queue */}
      <Card
        title={tx(lang, 'Danh sách tồn kho theo thứ tự ưu tiên xuất FEFO (FR-19, FR-20)', 'FEFO 優先出庫在庫一覧 (FR-19, FR-20)')}
        subtitle={tx(
          lang,
          'Tự động cảnh báo khi lô đạt >= 80% thời gian lưu tối đa của nhóm nhiệt',
          '温度帯の最大保管時間に対して 80%以上に達したロットを自動警告します'
        )}
      >
        <div className="space-y-2.5">
          {fefoQueue.length === 0 ? (
            <p className="text-sm text-slate-500">
              {tx(lang, 'Hiện không có lô nào đang lưu trong kho.', '現在倉庫に保管中のロットはありません。')}
            </p>
          ) : (
            fefoQueue.map((item, idx) => {
              const lot = warehouseLots.find((l) => l.id === item.lotId);
              if (!lot) return null;
              return (
                <div
                  key={lot.id}
                  className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                    item.isWarning
                      ? 'border-rose-300 bg-rose-50/60'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-bold">
                        FEFO #{idx + 1}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {lot.lotCode}
                      </span>
                      <span className="text-xs text-slate-700 font-medium">
                        {prodName(lot.productId)} ({formatNum(lot.currentKg, lang)} kg)
                      </span>
                      {item.isWarning && (
                        <Badge tone="rose">
                          <AlertTriangle className="w-3 h-3" />{' '}
                          {tx(lang, `Đã lưu ${item.usagePct}% hạn tối đa!`, `保管期限 ${item.usagePct}% 到達！`)}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {tx(lang, 'Đã lưu:', '保管経過:')}{' '}
                      <strong>
                        {item.hoursStored}
                        {tx(lang, 'h', '時間')} / {item.maxStorageHours}
                        {tx(lang, 'h', '時間')}
                      </strong>{' '}
                      · {tx(lang, 'Còn lại:', '残り:')}{' '}
                      <strong>
                        {item.remainingHours}
                        {tx(lang, 'h', '時間')}
                      </strong>
                      {lot.wmsSyncedAt && (
                        <span className="ml-2 text-emerald-700">
                          · {tx(lang, 'WMS synced lúc', 'WMS同期時刻')} {formatTime(lot.wmsSyncedAt, lang)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleWmsSync(lot.id)}
                    disabled={syncingLotId === lot.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingLotId === lot.id ? 'animate-spin' : ''}`} />
                    {tx(lang, 'Đồng bộ WMS API', 'WMS API同期')}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
