import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, hasOrgAccess, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, pushNotification, readDb } from '@/lib/db';
import { evaluateTripEta, validateTripAssignment } from '@/domain/transport';
import { Trip, TripAssignment, TripStop, TripType } from '@/types/transport-temp';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const db = await readDb();

  let trips = db.trips;
  if (!hasOrgAccess(user, [], { allowSystemAdmin: true })) {
    if (user.role === 'TAI_XE') {
      trips = trips.filter((t) => t.transportOrgId === user.orgId);
    } else if (user.role === 'KHACH_HANG') {
      const cusLotIds = new Set(
        db.lots.filter((l) => l.customerOrgId === user.orgId).map((l) => l.id)
      );
      trips = trips.filter((t) => t.assignments.some((a) => cusLotIds.has(a.lotId)));
    } else {
      trips = trips.filter((t) => t.stops.some((s) => s.orgId === user.orgId));
    }
  }

  return NextResponse.json({ trips });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['DIEU_PHOI_VIEN', 'QUAN_LY_QC']);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const {
    tripType,
    vehicleId,
    driverUserId,
    plannedDate,
    assignments,
    stops,
    targetTimeSlot,
    projectedArrivalTime,
  } = body as {
    tripType?: TripType;
    vehicleId?: string;
    driverUserId?: string;
    plannedDate?: string;
    assignments?: TripAssignment[];
    stops?: TripStop[];
    targetTimeSlot?: string;
    projectedArrivalTime?: string;
  };

  if (!tripType || !vehicleId || !plannedDate || !assignments?.length) {
    return NextResponse.json(
      { error: 'Thiếu loại chuyến, xe, ngày chạy hoặc danh sách lô hàng.' },
      { status: 400 }
    );
  }

  const result = await mutateDb((db) => {
    const vehicle = db.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return { error: 'Không tìm thấy phương tiện.', status: 404 };

    const lotsMap = new Map(db.lots.map((l) => [l.id, l]));
    // BR-05 & FR-23: Hard server-side enforcement
    const validation = validateTripAssignment(vehicle, assignments, lotsMap);
    if (!validation.valid) {
      return { error: validation.error, status: 400 };
    }

    const prefixMap: Record<TripType, string> = {
      THU_GOM: 'CH-TG',
      TRUNG_CHUYEN: 'CH-TC',
      GIAO_HANG: 'CH-GH',
    };
    const datePart = plannedDate.replace(/-/g, '').slice(2);
    const code = `${prefixMap[tripType]}-${datePart}-${String(db.trips.length + 1).padStart(2, '0')}`;

    const trip: Trip = {
      id: `TRIP-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      code,
      tripType,
      transportOrgId: vehicle.transportOrgId,
      vehicleId: vehicle.id,
      driverUserId: driverUserId || 'USER-DRV-ABA',
      plannedDate,
      status: 'MOI_TAO',
      assignments,
      totalWeightKg: validation.totalWeightKg,
      fillRatePct: validation.fillRatePct,
      stops: stops?.length
        ? stops
        : [
            {
              stopOrder: 1,
              orgId: 'ORG-WH-NECS',
              locationName: 'Điểm lấy hàng',
              address: 'ĐBSCL / Bến Lức',
              plannedTime: `${plannedDate}T08:00:00+07:00`,
              action: 'LAY_HANG',
            },
            {
              stopOrder: 2,
              orgId: 'ORG-CUS-BHX',
              locationName: 'Điểm giao hàng',
              address: 'TP.HCM',
              plannedTime: `${plannedDate}T11:30:00+07:00`,
              action: 'GIAO_HANG',
            },
          ],
      targetTimeSlot,
      projectedArrivalTime,
      isLateEta: false,
      createdAt: new Date().toISOString(),
    };

    const etaCheck = evaluateTripEta(trip);
    trip.isLateEta = etaCheck.isLateEta;

    db.trips.unshift(trip);

    appendAuditLog(db, user, {
      action: 'CREATE_TRIP',
      entityType: 'Trip',
      entityId: trip.id,
      summary: `Tạo chuyến ${trip.code} (${vehicle.plateNumber}, ${trip.totalWeightKg} kg, lấp đầy ${trip.fillRatePct}%)`,
      afterJson: trip,
    });

    pushNotification(db, {
      recipientOrgId: trip.transportOrgId,
      channel: ['IN_APP', 'ZALO_ZNS'],
      eventType: 'TRIP_ASSIGNED',
      title: `Lệnh chuyến mới ${trip.code}`,
      message: `Xe ${vehicle.plateNumber} được điều phối ${trip.assignments.length} lô (${trip.totalWeightKg} kg) ngày ${plannedDate}.`,
      relatedEntityId: trip.id,
    });

    return { trip, status: 201 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ trip: result.trip }, { status: 201 });
}
