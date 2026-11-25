'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, FileUp, Radio, Thermometer } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useCct } from '@/components/layout/CctContext';
import {
  displayOperationalText,
  displayPlace,
  formatDateTime,
  LOT_STATUS_I18N,
  tx,
} from '@/lib/i18n';
import { LoggerDevice, TempAlert, TempReading } from '@/types/transport-temp';
import { Lot } from '@/types/lot-epod';

export function TelemetryPanel() {
  const { refreshTick, pushToast, triggerRefresh, lang } = useCct();
  const [loggers, setLoggers] = useState<LoggerDevice[]>([]);
  const [readings, setReadings] = useState<TempReading[]>([]);
  const [alerts, setAlerts] = useState<Array<TempAlert & { needsReminderNow?: boolean }>>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedLoggerId, setSelectedLoggerId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [pickedFileName, setPickedFileName] = useState('');
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
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi giả lập IoT', 'IoTシミュレーションエラー'));
    pushToast(
      simulateMode === 'NORMAL' ? 'success' : 'warning',
      simulateMode === 'NORMAL'
        ? tx(
            lang,
            'Đã ghi nhận gói dữ liệu IoT bình thường (5 phút/lần)',
            '正常なIoTデータパケット（5分間隔）を記録しました'
          )
        : simulateMode === 'EXCURSION_20M'
          ? tx(
              lang,
              'Đã giả lập vượt ngưỡng 20 phút → Phát cảnh báo BR-07 & Zalo/SMS!',
              '20分間の温度逸脱をシミュレート → BR-07・Zalo/SMSアラートを発報しました！'
            )
          : tx(
              lang,
              'Đã giả lập mất tín hiệu 40 phút → Phát cảnh báo mất sóng BR-07!',
              '40分間の通信途絶をシミュレート → BR-07通信断アラートを発報しました！'
            )
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
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi nhập CSV', 'CSV取込エラー'));
    pushToast(
      'success',
      tx(
        lang,
        `Đã nhập ${data.importedCount} bản ghi gốc từ file CSV (FR-26)`,
        `CSVから原記録 ${data.importedCount} 件を取込ました (FR-26)`
      )
    );
    triggerRefresh();
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPickedFileName(file.name);
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
    if (!res.ok) return pushToast('error', data.error || tx(lang, 'Lỗi xác nhận cảnh báo', 'アラート確認エラー'));
    pushToast(
      'success',
      tx(
        lang,
        'Đã xác nhận cảnh báo & lưu hành động xử lý (FR-29)',
        'アラートを確認し、対応内容を保存しました (FR-29)'
      )
    );
    setAckAlert(null);
    setActionNote('');
    triggerRefresh();
  };

  const lotCode = (id: string) => lots.find((l) => l.id === id)?.lotCode ?? id;
  const lotStatusLabel = (status: string) => LOT_STATUS_I18N[status]?.[lang] ?? status;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          {tx(lang, 'Giám sát nhiệt độ & Cảnh báo Realtime (M7)', 'リアルタイム温度監視・アラート (M7)')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          {tx(
            lang,
            'BR-07: Cảnh báo khi ngoài dải > 15 phút hoặc mất tín hiệu > 30 phút. Cảnh báo không chặn luồng hàng (FR-30).',
            'BR-07: 許容温度逸脱 > 15分、またはLogger通信途絶 > 30分で即時アラート。物流フローは自動停止しません (FR-30)。'
          )}
        </p>
      </div>

      {/* IoT Simulator & CSV Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title={tx(lang, 'Giả lập thu nhận dữ liệu Logger / IoT (FR-26, FR-28)', 'Logger / IoT データ受信シミュレータ (FR-26, FR-28)')}
        >
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
                      {displayPlace(lg.name, lang)} ({lg.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {tx(lang, 'Gắn thử vào lô', '対象テストロット')}
                </label>
                <select
                  value={selectedLotId}
                  onChange={(e) => setSelectedLotId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lotCode} ({lotStatusLabel(l.status)})
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
                <Radio className="w-3.5 h-3.5" /> {tx(lang, 'Gửi 1 mẫu đạt chuẩn', '正常データを1件送信')}
              </button>
              <button
                onClick={() => simulateIoT('EXCURSION_20M')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
              >
                <Thermometer className="w-3.5 h-3.5" /> {tx(lang, 'Giả lập vượt ngưỡng 20p', '20分間の温度逸脱を模擬')}
              </button>
              <button
                onClick={() => simulateIoT('SIGNAL_LOSS_40M')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
              >
                <Activity className="w-3.5 h-3.5" /> {tx(lang, 'Giả lập mất sóng 40p', '40分間の通信途絶を模擬')}
              </button>
            </div>
          </div>
        </Card>

        <Card
          title={tx(lang, 'Nhập file CSV từ Logger không có kết nối (FR-26)', 'オフラインLogger CSV取込 (FR-26)')}
        >
          <form onSubmit={handleCsvUpload} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer">
                <span>{tx(lang, 'Chọn tệp CSV', 'ファイルを選択')}</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFilePick}
                  className="sr-only"
                />
              </label>
              <span className="text-xs text-slate-500 truncate">
                {pickedFileName || tx(lang, 'Chưa chọn tệp nào', 'ファイル未選択')}
              </span>
            </div>
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
              <FileUp className="w-3.5 h-3.5" />{' '}
              {tx(lang, 'Nhập dữ liệu gốc (không làm tròn)', '生データを取込（丸めなし）')}
            </button>
          </form>
        </Card>
      </div>

      {/* Alert Queue */}
      <Card
        title={tx(lang, 'Bảng cảnh báo nhiệt độ & mất tín hiệu (BR-07, FR-29)', '温度逸脱・通信途絶アラート一覧 (BR-07, FR-29)')}
        subtitle={tx(
          lang,
          'Cảnh báo quá 30 phút chưa xác nhận tự động gắn cờ nhắc lại',
          '30分を超えて未確認のアラートには自動的に再通知フラグが付与されます'
        )}
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
                    {a.alertType === 'VUOT_NGUONG'
                      ? tx(lang, 'Vượt ngưỡng nhiệt', '温度逸脱')
                      : tx(lang, 'Mất tín hiệu', '通信途絶')}
                  </Badge>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {tx(lang, 'Lô', 'ロット')} {lotCode(a.lotId)}
                  </span>
                  <span className="text-xs text-slate-600">{displayPlace(a.stage, lang)}</span>
                  {a.needsReminderNow && !a.acknowledgedAt && (
                    <Badge tone="rose">
                      {tx(lang, 'Nhắc lại > 30p (FR-29)', '再通知 > 30分 (FR-29)')}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-slate-600">
                  {tx(lang, 'Thời lượng:', '継続時間:')}{' '}
                  <strong>
                    {a.durationMinutes} {tx(lang, 'phút', '分')}
                  </strong>{' '}
                  · {tx(lang, 'Dải chuẩn:', '基準温度帯:')} {a.allowedRange}
                  {a.peakTempC !== undefined && (
                    <span>
                      {' '}
                      · {tx(lang, 'Đỉnh nhiệt:', '最高温度:')}{' '}
                      <strong className="text-rose-700">{a.peakTempC}°C</strong>
                    </span>
                  )}
                </div>
                {a.actionNote && (
                  <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {tx(lang, 'Đã xử lý:', '対応済:')}{' '}
                    {displayOperationalText(a.actionNote, lang)}
                  </div>
                )}
              </div>

              {!a.acknowledgedAt ? (
                <button
                  onClick={() => setAckAlert(a)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shrink-0"
                >
                  {tx(lang, 'Xác nhận & Ghi xử lý', '確認・対応記録')}
                </button>
              ) : (
                <Badge tone="emerald">{tx(lang, 'Đã xác nhận', '確認済')}</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Latest Readings Stream */}
      <Card
        title={tx(
          lang,
          'Bản ghi nhiệt độ gần nhất (Dữ liệu gốc bất biến - NFR-06)',
          '最新の温度測定ログ（改変不可の原記録 - NFR-06）'
        )}
      >
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
                  <div className="text-[11px] text-slate-400">{formatDateTime(r.timestamp, lang)}</div>
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
        title={tx(lang, 'Xác nhận đã xem & Ghi hành động xử lý (FR-29)', 'アラート確認・是正措置の記録 (FR-29)')}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAckSubmit} className="space-y-3">
          <textarea
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            rows={3}
            placeholder={tx(
              lang,
              'VD: Đã liên hệ tài xế đóng kín cửa khoang lạnh và kiểm tra máy nén...',
              '例: ドライバーへ連絡し、庫室ドアの密閉と冷凍機コンプレッサーを点検しました...'
            )}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm"
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAckAlert(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
            >
              {tx(lang, 'Đóng', '閉じる')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
            >
              {tx(lang, 'Lưu xác nhận', '確認を保存')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
