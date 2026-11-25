import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, forbidImmutable, hasOrgAccess, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, pushNotification, readDb } from '@/lib/db';
import { parseLoggerCsv } from '@/lib/csv';
import { evaluateLotTemperatureCompliance, findAlertsNeedingReminder } from '@/domain/temperature';
import { TempAlert, TempReading } from '@/types/transport-temp';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const db = await readDb();

  let loggers = db.loggers;
  let alerts = db.tempAlerts;

  if (!hasOrgAccess(user, [], { allowSystemAdmin: true })) {
    if (user.role === 'KHACH_HANG') {
      const cusLotIds = new Set(
        db.lots.filter((l) => l.customerOrgId === user.orgId).map((l) => l.id)
      );
      alerts = alerts.filter((a) => cusLotIds.has(a.lotId));
      loggers = [];
    } else {
      loggers = loggers.filter((lg) => lg.ownerOrgId === user.orgId);
      alerts = alerts.filter((a) => a.custodianOrgId === user.orgId);
    }
  }

  const loggerIdFilter = req.nextUrl.searchParams.get('loggerId');
  const readings = loggerIdFilter
    ? db.tempReadings.filter((r) => r.loggerId === loggerIdFilter).slice(-120)
    : db.tempReadings.slice(-150);

  const nowIso = new Date().toISOString();
  const needReminderIds = new Set(
    findAlertsNeedingReminder(alerts, nowIso, db.systemConfig.reminderMinutes).map((a) => a.id)
  );

  return NextResponse.json({
    loggers,
    readings,
    alerts: alerts.map((a) => ({
      ...a,
      needsReminderNow: needReminderIds.has(a.id) || a.escalationReminded,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, [
    'DIEU_PHOI_VIEN',
    'QUAN_LY_QC',
    'NHAN_VIEN_SO_CHE',
    'NHAN_VIEN_KHO',
    'TAI_XE',
  ]);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const {
    action,
    loggerId,
    lotId,
    csvText,
    tempC,
    humidityPct,
    alertId,
    actionNote,
    simulateMode,
  } = body as {
    action?: 'SIMULATE_IOT' | 'UPLOAD_CSV' | 'ACK_ALERT';
    loggerId?: string;
    lotId?: string;
    csvText?: string;
    tempC?: number;
    humidityPct?: number;
    alertId?: string;
    actionNote?: string;
    simulateMode?: 'NORMAL' | 'EXCURSION_20M' | 'SIGNAL_LOSS_40M';
  };

  const result = await mutateDb((db) => {
    const nowIso = new Date().toISOString();

    if (action === 'ACK_ALERT') {
      if (!alertId || !actionNote?.trim()) {
        return { error: 'Vui lòng chọn cảnh báo và ghi hành động xử lý (FR-29).', status: 400 };
      }
      const alert = db.tempAlerts.find((a) => a.id === alertId);
      if (!alert) return { error: 'Không tìm thấy cảnh báo.', status: 404 };

      if (!hasOrgAccess(user, [alert.custodianOrgId])) {
        return { error: 'Không được phép xác nhận cảnh báo của đơn vị khác.', status: 403 };
      }

      alert.acknowledgedAt = nowIso;
      alert.acknowledgedByUserId = user.id;
      alert.actionNote = actionNote.trim();

      appendAuditLog(db, user, {
        action: 'ACK_TEMP_ALERT',
        entityType: 'TempAlert',
        entityId: alert.id,
        summary: `Xác nhận cảnh báo ${alert.id} với hành động: ${alert.actionNote}`,
        afterJson: alert,
      });
      return { alert, status: 200 };
    }

    if (action === 'UPLOAD_CSV') {
      if (!csvText?.trim()) {
        return { error: 'Nội dung CSV trống.', status: 400 };
      }
      const parsed = parseLoggerCsv(csvText, loggerId);
      if (!parsed.readings.length) {
        return { error: parsed.errors.join('; ') || 'Không parse được dữ liệu CSV.', status: 400 };
      }
      db.tempReadings.push(...parsed.readings);

      appendAuditLog(db, user, {
        action: 'IMPORT_LOGGER_CSV',
        entityType: 'TempReading',
        entityId: loggerId || 'BATCH_CSV',
        summary: `Nhập ${parsed.readings.length} bản ghi nhiệt độ từ file CSV (FR-26)`,
        afterJson: { count: parsed.readings.length, errors: parsed.errors },
      });

      return { importedCount: parsed.readings.length, errors: parsed.errors, status: 201 };
    }

    // SIMULATE_IOT
    const targetLogger = db.loggers.find((l) => l.id === loggerId) ?? db.loggers[0];
    if (!targetLogger) return { error: 'Không có thiết bị logger.', status: 404 };

    const targetLot = lotId
      ? db.lots.find((l) => l.id === lotId)
      : db.lots.find((l) => l.locationSegments.some((s) => s.loggerId === targetLogger.id));

    const tempGroup = targetLot
      ? db.tempGroups.find((t) => t.id === targetLot.tempGroupId)
      : db.tempGroups[0];

    const inserted: TempReading[] = [];
    const baseMs = Date.now();

    if (simulateMode === 'EXCURSION_20M') {
      const excursionTemp = tempC ?? (tempGroup ? tempGroup.maxTempC + 5.2 : 9.2);
      for (let i = 0; i < 5; i++) {
        const ts = new Date(baseMs - (4 - i) * 5 * 60000).toISOString();
        inserted.push({
          id: `READ-IOT-${baseMs}-${i}`,
          loggerId: targetLogger.id,
          timestamp: ts,
          tempC: excursionTemp,
          humidityPct: humidityPct ?? 88,
          source: 'IOT',
          ingestedAt: nowIso,
        });
      }
      db.tempReadings.push(...inserted);

      if (targetLot) {
        targetLot.hasTempAlert = true;
        const alert: TempAlert = {
          id: `ALT-${Date.now()}`,
          alertType: 'VUOT_NGUONG',
          lotId: targetLot.id,
          loggerId: targetLogger.id,
          stage: targetLogger.name,
          custodianOrgId: targetLot.currentCustodianOrgId,
          startTime: inserted[0].timestamp,
          endTime: inserted[inserted.length - 1].timestamp,
          durationMinutes: 20,
          peakTempC: excursionTemp,
          allowedRange: tempGroup ? `${tempGroup.minTempC}–${tempGroup.maxTempC}°C` : '0–4°C',
          escalationReminded: false,
          createdAt: nowIso,
        };
        db.tempAlerts.unshift(alert);

        pushNotification(db, {
          recipientOrgId: targetLot.currentCustodianOrgId,
          recipientRole: 'DIEU_PHOI_VIEN',
          channel: ['IN_APP', 'ZALO_ZNS', 'SMS'],
          eventType: 'TEMP_ALERT',
          title: `Cảnh báo vượt ngưỡng nhiệt: ${targetLot.lotCode}`,
          message: `${targetLogger.name} ghi nhận ${excursionTemp}°C liên tục 20 phút (> 15 phút theo BR-07). Luồng hàng không bị chặn (FR-30).`,
          relatedEntityId: alert.id,
        });
      }
    } else if (simulateMode === 'SIGNAL_LOSS_40M') {
      if (targetLot) {
        targetLot.hasDataGap = true;
        const alert: TempAlert = {
          id: `ALT-${Date.now()}`,
          alertType: 'MAT_TIN_HIEU',
          lotId: targetLot.id,
          loggerId: targetLogger.id,
          stage: targetLogger.name,
          custodianOrgId: targetLot.currentCustodianOrgId,
          startTime: new Date(baseMs - 40 * 60000).toISOString(),
          endTime: nowIso,
          durationMinutes: 40,
          allowedRange: tempGroup ? `${tempGroup.minTempC}–${tempGroup.maxTempC}°C` : '0–4°C',
          escalationReminded: false,
          createdAt: nowIso,
        };
        db.tempAlerts.unshift(alert);

        pushNotification(db, {
          recipientOrgId: targetLot.currentCustodianOrgId,
          recipientRole: 'DIEU_PHOI_VIEN',
          channel: ['IN_APP', 'ZALO_ZNS', 'SMS'],
          eventType: 'SIGNAL_LOSS_ALERT',
          title: `Mất tín hiệu logger > 30 phút: ${targetLot.lotCode}`,
          message: `${targetLogger.name} mất tín hiệu 40 phút (BR-07). Khoảng trống dữ liệu sẽ tính ngoài dải.`,
          relatedEntityId: alert.id,
        });
      }
    } else {
      const okTemp =
        tempC ?? (tempGroup ? Math.round(((tempGroup.minTempC + tempGroup.maxTempC) / 2) * 10) / 10 : 2.5);
      const reading: TempReading = {
        id: `READ-IOT-${baseMs}`,
        loggerId: targetLogger.id,
        timestamp: nowIso,
        tempC: okTemp,
        humidityPct: humidityPct ?? 92,
        source: 'IOT',
        ingestedAt: nowIso,
      };
      inserted.push(reading);
      db.tempReadings.push(reading);
    }

    targetLogger.lastSeenAt = nowIso;

    if (targetLot) {
      const comp = evaluateLotTemperatureCompliance({
        lot: targetLot,
        allLots: db.lots,
        allReadings: db.tempReadings,
        tempGroup,
        config: db.systemConfig,
        existingAlerts: db.tempAlerts,
      });
      if (comp.hasExcursion) targetLot.hasTempAlert = true;
      if (comp.hasDataGap) targetLot.hasDataGap = true;
    }

    return { inserted, status: 201 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: result.status });
}

export async function PUT() {
  return forbidImmutable('Dữ liệu nhiệt độ gốc từ logger là bất biến, không thể sửa (NFR-06).');
}

export async function DELETE() {
  return forbidImmutable('Dữ liệu nhiệt độ gốc từ logger là bất biến, không thể xóa (NFR-06).');
}
