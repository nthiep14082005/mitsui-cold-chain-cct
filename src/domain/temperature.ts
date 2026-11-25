import { TempGroup } from '@/types/catalog';
import { SystemConfig } from '@/types/common';
import { LocationSegment, Lot } from '@/types/lot-epod';
import { TempAlert, TempReading } from '@/types/transport-temp';

export interface LotReadingPoint extends TempReading {
  stage: LocationSegment['stage'];
  locationLabel: string;
  custodianOrgId: string;
  inRange: boolean;
}

/**
 * Collects continuous location segments from parent chain (before split) + own segments.
 */
export function getLotContinuousSegments(lot: Lot, allLots: Lot[]): LocationSegment[] {
  const lotMap = new Map(allLots.map((l) => [l.id, l]));
  const chain: Lot[] = [];
  let cur: Lot | undefined = lot;
  const visited = new Set<string>();
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentLotId ? lotMap.get(cur.parentLotId) : undefined;
  }

  // Merge segments chronologically without duplicating identical parent segments
  const seenKey = new Set<string>();
  const merged: LocationSegment[] = [];
  for (const item of chain) {
    for (const seg of item.locationSegments) {
      const k = `${seg.stage}|${seg.loggerId}|${seg.fromTime}`;
      if (!seenKey.has(k)) {
        seenKey.add(k);
        merged.push(seg);
      }
    }
  }
  return merged.sort((a, b) => new Date(a.fromTime).getTime() - new Date(b.fromTime).getTime());
}

/**
 * FR-27: Maps logger readings to a lot across cooling room -> feeder truck -> cold storage -> delivery truck
 * without rounding or resampling original temperature values (Section 6.2).
 */
export function getLotContinuousReadings(
  lot: Lot,
  allLots: Lot[],
  allReadings: TempReading[],
  tempGroup: TempGroup | undefined
): LotReadingPoint[] {
  const segments = getLotContinuousSegments(lot, allLots);
  const points: LotReadingPoint[] = [];
  const seenReading = new Set<string>();

  for (const seg of segments) {
    const fromMs = new Date(seg.fromTime).getTime();
    const toMs = seg.toTime ? new Date(seg.toTime).getTime() : Infinity;

    for (const r of allReadings) {
      if (r.loggerId !== seg.loggerId) continue;
      const rMs = new Date(r.timestamp).getTime();
      if (rMs >= fromMs && rMs <= toMs) {
        const dedup = `${r.id}|${seg.stage}`;
        if (seenReading.has(dedup)) continue;
        seenReading.add(dedup);
        const inRange = tempGroup
          ? r.tempC >= tempGroup.minTempC && r.tempC <= tempGroup.maxTempC
          : true;
        points.push({
          ...r,
          stage: seg.stage,
          locationLabel: seg.locationLabel,
          custodianOrgId: seg.custodianOrgId,
          inRange,
        });
      }
    }
  }

  return points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * BR-07 & Section 9.1: Detects continuous temperature excursion (>15 mins) and logger signal loss (>30 mins),
 * and calculates % of chain time inside the target range (with data gaps counted as out-of-range).
 */
export function evaluateLotTemperatureCompliance(params: {
  lot: Lot;
  allLots: Lot[];
  allReadings: TempReading[];
  tempGroup: TempGroup | undefined;
  config: SystemConfig;
  existingAlerts?: TempAlert[];
}) {
  const { lot, allLots, allReadings, tempGroup, config, existingAlerts = [] } = params;
  const segments = getLotContinuousSegments(lot, allLots);
  const points = getLotContinuousReadings(lot, allLots, allReadings, tempGroup);

  const detectedAlerts: Omit<TempAlert, 'id' | 'createdAt' | 'escalationReminded'>[] = [];
  let totalMinutes = 0;
  let inRangeMinutes = 0;
  let hasDataGap = false;
  let hasExcursion = false;

  for (const seg of segments) {
    const fromMs = new Date(seg.fromTime).getTime();
    const segPoints = points.filter((p) => {
      const t = new Date(p.timestamp).getTime();
      const toMs = seg.toTime ? new Date(seg.toTime).getTime() : Infinity;
      return p.loggerId === seg.loggerId && t >= fromMs && t <= toMs;
    });
    const toMs = seg.toTime
      ? new Date(seg.toTime).getTime()
      : segPoints.length
        ? new Date(segPoints[segPoints.length - 1].timestamp).getTime()
        : fromMs;

    const segDurationMin = Math.max(0, (toMs - fromMs) / 60000);
    if (segDurationMin <= 0) continue;
    totalMinutes += segDurationMin;

    if (segPoints.length === 0) {
      if (segDurationMin > config.signalLossMinutes) {
        hasDataGap = true;
        detectedAlerts.push({
          alertType: 'MAT_TIN_HIEU',
          lotId: lot.id,
          loggerId: seg.loggerId,
          stage: seg.locationLabel,
          custodianOrgId: seg.custodianOrgId,
          startTime: seg.fromTime,
          endTime: seg.toTime,
          durationMinutes: Math.round(segDurationMin),
          allowedRange: tempGroup ? `${tempGroup.minTempC}–${tempGroup.maxTempC}°C` : '',
        });
      }
      continue;
    }

    // Check internal gaps between readings
    let excursionStart: LotReadingPoint | null = null;
    let excursionPeak: number | undefined;
    let outOrGapMinutes = 0;

    // Leading gap from segment start
    const firstGapMin = (new Date(segPoints[0].timestamp).getTime() - fromMs) / 60000;
    if (firstGapMin > config.signalLossMinutes) {
      hasDataGap = true;
      outOrGapMinutes += firstGapMin;
      detectedAlerts.push({
        alertType: 'MAT_TIN_HIEU',
        lotId: lot.id,
        loggerId: seg.loggerId,
        stage: seg.locationLabel,
        custodianOrgId: seg.custodianOrgId,
        startTime: seg.fromTime,
        endTime: segPoints[0].timestamp,
        durationMinutes: Math.round(firstGapMin),
        allowedRange: tempGroup ? `${tempGroup.minTempC}–${tempGroup.maxTempC}°C` : '',
      });
    }

    for (let i = 0; i < segPoints.length; i++) {
      const p = segPoints[i];
      if (!p.inRange) {
        if (!excursionStart) {
          excursionStart = p;
          excursionPeak = p.tempC;
        } else if (excursionPeak === undefined || Math.abs(p.tempC) > Math.abs(excursionPeak)) {
          excursionPeak = p.tempC;
        }
      } else if (excursionStart) {
        const excMin =
          (new Date(p.timestamp).getTime() - new Date(excursionStart.timestamp).getTime()) / 60000;
        if (excMin > config.tempAlertMinutes) {
          hasExcursion = true;
          outOrGapMinutes += excMin;
          detectedAlerts.push({
            alertType: 'VUOT_NGUONG',
            lotId: lot.id,
            loggerId: seg.loggerId,
            stage: seg.locationLabel,
            custodianOrgId: seg.custodianOrgId,
            startTime: excursionStart.timestamp,
            endTime: p.timestamp,
            durationMinutes: Math.round(excMin),
            peakTempC: excursionPeak,
            allowedRange: tempGroup ? `${tempGroup.minTempC}–${tempGroup.maxTempC}°C` : '',
          });
        }
        excursionStart = null;
        excursionPeak = undefined;
      }

      if (i > 0) {
        const gapMin =
          (new Date(p.timestamp).getTime() - new Date(segPoints[i - 1].timestamp).getTime()) / 60000;
        if (gapMin > config.signalLossMinutes) {
          hasDataGap = true;
          outOrGapMinutes += gapMin;
          detectedAlerts.push({
            alertType: 'MAT_TIN_HIEU',
            lotId: lot.id,
            loggerId: seg.loggerId,
            stage: seg.locationLabel,
            custodianOrgId: seg.custodianOrgId,
            startTime: segPoints[i - 1].timestamp,
            endTime: p.timestamp,
            durationMinutes: Math.round(gapMin),
            allowedRange: tempGroup ? `${tempGroup.minTempC}–${tempGroup.maxTempC}°C` : '',
          });
        }
      }
    }

    if (excursionStart) {
      const endPoint = segPoints[segPoints.length - 1];
      const excMin =
        (new Date(endPoint.timestamp).getTime() - new Date(excursionStart.timestamp).getTime()) /
        60000;
      if (excMin > config.tempAlertMinutes) {
        hasExcursion = true;
        outOrGapMinutes += excMin;
        detectedAlerts.push({
          alertType: 'VUOT_NGUONG',
          lotId: lot.id,
          loggerId: seg.loggerId,
          stage: seg.locationLabel,
          custodianOrgId: seg.custodianOrgId,
          startTime: excursionStart.timestamp,
          endTime: endPoint.timestamp,
          durationMinutes: Math.round(excMin),
          peakTempC: excursionPeak,
          allowedRange: tempGroup ? `${tempGroup.minTempC}–${tempGroup.maxTempC}°C` : '',
        });
      }
    }

    // Also count existing explicit alerts on this segment if not covered
    const segInRange = Math.max(0, segDurationMin - outOrGapMinutes);
    inRangeMinutes += segInRange;
  }

  // Incorporate explicit alerts stored on the lot (e.g., manual simulation or historical)
  const lotExplicitAlerts = existingAlerts.filter((a) => a.lotId === lot.id);
  for (const ea of lotExplicitAlerts) {
    if (ea.alertType === 'VUOT_NGUONG') hasExcursion = true;
    if (ea.alertType === 'MAT_TIN_HIEU') hasDataGap = true;
  }

  const inRangePct =
    totalMinutes > 0
      ? Math.round((inRangeMinutes / totalMinutes) * 1000) / 10
      : points.length > 0
        ? Math.round((points.filter((p) => p.inRange).length / points.length) * 1000) / 10
        : 100;

  return {
    points,
    detectedAlerts,
    hasExcursion: hasExcursion || lot.hasTempAlert,
    hasDataGap: hasDataGap || lot.hasDataGap,
    totalMinutes: Math.round(totalMinutes),
    inRangeMinutes: Math.round(inRangeMinutes),
    inRangePct,
  };
}

/**
 * FR-29: Flags unacknowledged alerts older than reminderMinutes (default 30 mins).
 */
export function findAlertsNeedingReminder(
  alerts: TempAlert[],
  nowIso: string,
  reminderMinutes = 30
): TempAlert[] {
  const nowMs = new Date(nowIso).getTime();
  return alerts.filter((a) => {
    if (a.acknowledgedAt || a.escalationReminded) return false;
    const createdMs = new Date(a.createdAt).getTime();
    return (nowMs - createdMs) / 60000 >= reminderMinutes;
  });
}
