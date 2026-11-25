import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, pushNotification } from '@/lib/db';
import { evaluateTripEta } from '@/domain/transport';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['TAI_XE', 'DIEU_PHOI_VIEN', 'QUAN_LY_QC']);
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await context.params;

  const body = await req.json().catch(() => ({}));
  const {
    action,
    stopOrder,
    gpsLat,
    gpsLng,
    projectedArrivalTime,
    recordedAt,
  } = body as {
    action?: 'ACCEPT' | 'START' | 'CHECK_IN' | 'COMPLETE' | 'UPDATE_ETA';
    stopOrder?: number;
    gpsLat?: number;
    gpsLng?: number;
    projectedArrivalTime?: string;
    recordedAt?: string;
  };

  const result = await mutateDb((db) => {
    const trip = db.trips.find((t) => t.id === id);
    if (!trip) return { error: 'Không tìm thấy chuyến xe.', status: 404 };

    if (user.role === 'TAI_XE' && trip.transportOrgId !== user.orgId) {
      return { error: 'Không được phép thao tác chuyến của nhà vận tải khác (NFR-07).', status: 403 };
    }

    const before = { ...trip };
    const nowIso = recordedAt || new Date().toISOString();

    if (action === 'ACCEPT') {
      trip.status = 'DA_NHAN_LENH';
    } else if (action === 'START') {
      trip.status = 'DANG_CHAY';
    } else if (action === 'CHECK_IN') {
      // NFR-09: Only collect GPS while trip is active (DANG_CHAY)
      if (trip.status !== 'DANG_CHAY' && trip.status !== 'DA_NHAN_LENH') {
        return {
          error: 'Tuân thủ NFR-09: Chỉ thu thập GPS khi chuyến xe đang hoạt động.',
          status: 400,
        };
      }
      trip.status = 'DANG_CHAY';
      const stop = trip.stops.find((s) => s.stopOrder === (stopOrder ?? 1)) ?? trip.stops[0];
      if (stop) {
        stop.actualCheckInTime = nowIso;
        stop.gpsLat = gpsLat ?? stop.gpsLat ?? 10.6352;
        stop.gpsLng = gpsLng ?? stop.gpsLng ?? 106.4847;
      }
    } else if (action === 'COMPLETE') {
      trip.status = 'HOAN_TAT';
    } else if (action === 'UPDATE_ETA' && projectedArrivalTime) {
      trip.projectedArrivalTime = projectedArrivalTime;
      const eta = evaluateTripEta(trip);
      trip.isLateEta = eta.isLateEta;
      if (eta.isLateEta) {
        pushNotification(db, {
          recipientRole: 'DIEU_PHOI_VIEN',
          channel: ['IN_APP', 'ZALO_ZNS'],
          eventType: 'LATE_ETA',
          title: `Cảnh báo trễ giờ đến dự kiến (FR-25): ${trip.code}`,
          message: `Chuyến ${trip.code} dự kiến đến trễ ${eta.delayMinutes} phút so với khung giờ ${trip.targetTimeSlot}.`,
          relatedEntityId: trip.id,
        });
      }
    }

    appendAuditLog(db, user, {
      action: `TRIP_${action ?? 'UPDATE'}`,
      entityType: 'Trip',
      entityId: trip.id,
      summary: `Cập nhật chuyến ${trip.code} (${action})`,
      beforeJson: before,
      afterJson: trip,
    });

    return { trip, status: 200 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ trip: result.trip });
}
