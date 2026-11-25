'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { WarehousePanel } from '@/components/modules/cold-storage/WarehousePanel';
import { TransportPanel } from '@/components/modules/transport/TransportPanel';
import { useCct } from '@/components/layout/CctContext';
import { Organization } from '@/types/common';
import { Product, TempGroup, Vehicle } from '@/types/catalog';
import { Lot } from '@/types/lot-epod';
import { Trip } from '@/types/transport-temp';

export function WarehouseTransportPanel() {
  const { refreshTick } = useCct();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tempGroups, setTempGroups] = useState<TempGroup[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [fefoQueue, setFefoQueue] = useState([]);

  const loadData = useCallback(async () => {
    const [cRes, lRes, tRes] = await Promise.all([
      fetch('/api/catalog', { cache: 'no-store' }),
      fetch('/api/lots', { cache: 'no-store' }),
      fetch('/api/trips', { cache: 'no-store' }),
    ]);
    if (cRes.ok) {
      const cat = await cRes.json();
      setOrgs(cat.organizations ?? []);
      setVehicles(cat.vehicles ?? []);
      setProducts(cat.products ?? []);
      setTempGroups(cat.tempGroups ?? []);
    }
    if (lRes.ok) {
      const lData = await lRes.json();
      setLots(lData.lots ?? []);
      setFefoQueue(lData.fefoQueue ?? []);
    }
    if (tRes.ok) {
      setTrips((await tRes.json()).trips ?? []);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTick]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Kho lạnh Bến Lức & Điều phối Vận tải (M5, M6)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Quản lý buồng lưu theo nhóm nhiệt, cảnh báo tồn kho &gt;= 80%, xuất FEFO và xếp chuyến tuân thủ BR-05.
        </p>
      </div>

      <WarehousePanel
        organizations={orgs}
        lots={lots}
        products={products}
        tempGroups={tempGroups}
        fefoQueue={fefoQueue}
      />

      <TransportPanel
        vehicles={vehicles}
        lots={lots}
        products={products}
        tempGroups={tempGroups}
        trips={trips}
      />
    </div>
  );
}
