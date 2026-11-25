'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, FileUp, Radio, Thermometer } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useCct } from '@/components/layout/CctContext';
import { LoggerDevice, TempAlert, TempReading } from '@/types/transport-temp';
import { Lot } from '@/types/lot-epod';

export function TelemetryPanel() {
  const { refreshTick, pushToast, triggerRefresh } = useCct();
  const [loggers, setLoggers] = useState<LoggerDevice[]>([]);
  const [readings, setReadings] = useState<TempReading[]>([]);
  const [alerts, setAlerts] = useState<Array<TempAlert & { needsReminderNow?: boolean }>>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedLoggerId, setSelectedLoggerId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [csvText, setCsvText] = useState(
    'loggerId,timestamp,tempC,humidityPct\nLOG-XE-88120,2026-11-25T18:00:00+07:00,2.45,91\nLOG-XE-88120,2026-11-25T18:05:00+07:00,2.52,92'
  );
  const [ackAlert, setAckAlert] = useState<TempAlert | null>(null);
  const [actionNote, setActionNote] = useState('');

  const loadData = useCallback(async () => {
    const [tRes, lRes] = await Promise.all([
      fetch('/api/telemetry', { cache: 'no-store' }),
      fetch('/api/lots', { cache: 'no-store' }),
    ]);
    if (tRes.ok) {
      const data = await tRes.json();
      setLoggers(data.loggers ?? []);
      setReadings(data.readings ?? []);
      setAlerts(data.alerts ?? []);
      if (!selectedLoggerId && data.loggers?.[0]) setSelectedLoggerId(data.loggers[0].id);
    }
    if (lRes.ok) {
      const lData = await lRes.json();
      const active = (lData.lots ?? []).filter((l: Lot) => l.childLotIds.length === 0);
      setLots(active);
      if (!selectedLotId && active[0]) setSelectedLotId(active[0].id);
    }
  }, [selectedLoggerId, selectedLotId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTick]);

  const simulateIoT = async (simulateMode: 'NORMAL' | 'EXCURSION_20M' | 'SIGNAL_LOSS_40M') => {
    const res = await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SIMULATE_IOT',
        loggerId: selectedLoggerId,
        lotId: selectedLotId,
        simulateMode,
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi giả lập IoT');
    pushToast(
      simulateMode === 'NORMAL' ? 'success' : 'warning',
      simulateMode === 'NORMAL'
        ? 'Đã ghi nhận gói dữ liệu IoT bình thường (5 phút/lần)'
        : simulateMode === 'EXCURSION_20M'
          ? 'Đã giả lập vượt ngưỡng 20 phút → Phát cảnh báo BR-07 & Zalo/SMS!'
          : 'Đã giả lập mất tín hiệu 40 phút → Phát cảnh báo mất sóng BR-07!'
    );
    triggerRefresh();
  };

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPLOAD_CSV',
        loggerId: selectedLoggerId,
        csvText,
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi nhập CSV');
    pushToast('success', `Đã nhập ${data.importedCount} bản ghi gốc từ file CSV (FR-26)`);
    triggerRefresh();
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const handleAckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ackAlert) return;
    const res = await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ACK_ALERT',
        alertId: ackAlert.id,
        actionNote,
      }),
    });
    const data = await res.json();
    if (!res.ok) return pushToast('error', data.error || 'Lỗi xác nhận cảnh báo');
    pushToast('success', 'Đã xác nhận cảnh báo & lưu hành động xử lý (FR-29)');
    setAckAlert(null);
    setActionNote('');
    triggerRefresh();
  };

  const lotCode = (id: string) => lots.find((l) => l.id === id)?.lotCode ?? id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Giám sát nhiệt độ & Cảnh báo Realtime (M7)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          BR-07: Cảnh báo khi ngoài dải &gt; 15 phút hoặc mất tín hiệu &gt; 30 phút. Cảnh báo không chặn luồng hàng (FR-30).
        </p>
      </div>

      {/* IoT Simulator & CSV Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Giả lập thu nhận dữ liệu Logger / IoT (FR-26, FR-28)">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Logger</label>
                <select
                  value={selectedLoggerId}
                  onChange={(e) => setSelectedLoggerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {loggers.map((lg) => (
                    <option key={lg.id} value={lg.id}>
                      {lg.name} ({lg.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Gắn thử vào lô</label>
                <select
                  value={selectedLotId}
                  onChange={(e) => setSelectedLotId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lotCode} ({l.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => simulateIoT('NORMAL')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
              >
                <Radio className="w-3.5 h-3.5" /> Gửi 1 mẫu đạt chuẩn
              </button>
              <button
                onClick={() => simulateIoT('EXCURSION_20M')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
              >
                <Thermometer className="w-3.5 h-3.5" /> Giả lập vượt ngưỡng 20p
              </button>
              <button
                onClick={() => simulateIoT('SIGNAL_LOSS_40M')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
              >
                <Activity className="w-3.5 h-3.5" /> Giả lập mất sóng 40p
              </button>
            </div>
          </div>
        </Card>

        <Card title="Nhập file CSV từ Logger không có kết nối (FR-26)">
          <form onSubmit={handleCsvUpload} className="space-y-3">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFilePick}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-semibold"
            />
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
            >
              <FileUp className="w-3.5 h-3.5" /> Nhập dữ liệu gốc (không làm tròn)
            </button>
          </form>
        </Card>
      </div>

      {/* Alert Queue */}
      <Card
        title="Bảng cảnh báo nhiệt độ & mất tín hiệu (BR-07, FR-29)"
        subtitle="Cảnh báo quá 30 phút chưa xác nhận tự động gắn cờ nhắc lại"
      >
        <div className="space-y-3">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                a.acknowledgedAt
                  ? 'border-slate-200 bg-slate-50/60'
                  : 'border-rose-300 bg-rose-50/50'
              }`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.alertType === 'VUOT_NGUONG' ? 'rose' : 'amber'}>
                    <AlertTriangle className="w-3 h-3" />
                    {a.alertType === 'VUOT_NGUONG' ? 'Vượt ngưỡng nhiệt' : 'Mất tín hiệu'}
                  </Badge>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    Lô {lotCode(a.lotId)}
                  </span>
                  <span className="text-xs text-slate-600">{a.stage}</span>
                  {a.needsReminderNow && !a.acknowledgedAt && (
                    <Badge tone="rose">Nhắc lại &gt; 30p (FR-29)</Badge>
                  )}
                </div>
                <div className="text-xs text-slate-600">
                  Thời lượng: <strong>{a.durationMinutes} phút</strong> · Dải chuẩn: {a.allowedRange}
                  {a.peakTempC !== undefined && (
                    <span> · Đỉnh nhiệt: <strong className="text-rose-700">{a.peakTempC}°C</strong></span>
                  )}
                </div>
                {a.actionNote && (
                  <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã xử lý: {a.actionNote}
                  </div>
                )}
              </div>

              {!a.acknowledgedAt ? (
                <button
                  onClick={() => setAckAlert(a)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shrink-0"
                >
                  Xác nhận & Ghi xử lý
                </button>
              ) : (
                <Badge tone="emerald">Đã xác nhận</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Latest Readings Stream */}
      <Card title="Bản ghi nhiệt độ gần nhất (Dữ liệu gốc bất biến - NFR-06)">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[...readings]
            .slice(-12)
            .reverse()
            .map((r) => (
              <div
                key={r.id}
                className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-mono font-bold text-slate-800">{r.loggerId}</div>
                  <div className="text-[11px] text-slate-400">
                    {new Date(r.timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">{r.tempC}°C</div>
                  <Badge tone={r.source === 'CSV' ? 'purple' : 'slate'}>{r.source}</Badge>
                </div>
              </div>
            ))}
        </div>
      </Card>

      <Modal
        open={Boolean(ackAlert)}
        onClose={() => setAckAlert(null)}
        title="Xác nhận đã xem & Ghi hành động xử lý (FR-29)"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAckSubmit} className="space-y-3">
          <textarea
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            rows={3}
            placeholder="VD: Đã liên hệ tài xế đóng kín cửa khoang lạnh và kiểm tra máy nén..."
            className="w-full rounded-xl border border-slate-200 p-3 text-sm"
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAckAlert(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
            >
              Đóng
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              Lưu xác nhận
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
