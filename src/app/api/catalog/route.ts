import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, readDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const db = await readDb();

  const isMitsui =
    user.role === 'DIEU_PHOI_VIEN' ||
    user.role === 'QUAN_LY_QC' ||
    user.role === 'QUAN_TRI_HE_THONG';

  // NFR-07: Isolate contracts so customers never see other customers' prices or partner rates
  const frameworkContracts = isMitsui
    ? user.role === 'QUAN_TRI_HE_THONG'
      ? db.frameworkContracts.map((fc) => ({ ...fc, unitPriceVndPerKg: 0, compensationRateVndPerKg: 0 }))
      : db.frameworkContracts
    : user.role === 'KHACH_HANG'
      ? db.frameworkContracts.filter((fc) => fc.customerOrgId === user.orgId)
      : [];

  const partnerContracts =
    user.role === 'QUAN_LY_QC' || user.role === 'DIEU_PHOI_VIEN'
      ? db.partnerContracts
      : ['NHA_CUNG_CAP', 'NHAN_VIEN_SO_CHE', 'NHAN_VIEN_KHO', 'TAI_XE'].includes(user.role)
        ? db.partnerContracts.filter((pc) => pc.partnerOrgId === user.orgId)
        : [];

  return NextResponse.json({
    organizations: db.organizations,
    users:
      isMitsui
        ? db.users
        : db.users.filter((u) => u.orgId === user.orgId),
    tempGroups: db.tempGroups,
    products: db.products,
    vehicles: db.vehicles,
    frameworkContracts,
    partnerContracts,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['QUAN_TRI_HE_THONG', 'QUAN_LY_QC']);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const { entityType, data } = body as { entityType?: string; data?: Record<string, unknown> };
  if (!entityType || !data) {
    return NextResponse.json({ error: 'Thiếu entityType hoặc data.' }, { status: 400 });
  }

  // Contracts managed by QUAN_LY_QC; master catalog managed by QUAN_TRI_HE_THONG
  if (
    (entityType === 'frameworkContract' || entityType === 'partnerContract') &&
    user.role !== 'QUAN_LY_QC' &&
    user.role !== 'QUAN_TRI_HE_THONG'
  ) {
    return forbidCrossOrg();
  }
  if (
    !['frameworkContract', 'partnerContract'].includes(entityType) &&
    user.role !== 'QUAN_TRI_HE_THONG'
  ) {
    return NextResponse.json(
      { error: 'Chỉ Quản trị hệ thống mới được thêm danh mục nền (FR-01..FR-03).' },
      { status: 403 }
    );
  }

  const created = await mutateDb((db) => {
    const id = String(data.id || `${entityType.toUpperCase()}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`);
    const record = { ...data, id };

    switch (entityType) {
      case 'organization':
        db.organizations.push(record as never);
        break;
      case 'user':
        db.users.push(record as never);
        break;
      case 'tempGroup':
        db.tempGroups.push(record as never);
        break;
      case 'product':
        db.products.push(record as never);
        break;
      case 'vehicle':
        db.vehicles.push(record as never);
        break;
      case 'frameworkContract':
        db.frameworkContracts.push(record as never);
        break;
      case 'partnerContract':
        db.partnerContracts.push(record as never);
        break;
      default:
        return null;
    }

    appendAuditLog(db, user, {
      action: 'CREATE_CATALOG',
      entityType,
      entityId: id,
      summary: `Tạo mới danh mục ${entityType}: ${String(data.name || data.code || data.plateNumber || id)}`,
      afterJson: record,
    });

    return record;
  });

  if (!created) {
    return NextResponse.json({ error: 'entityType không được hỗ trợ.' }, { status: 400 });
  }
  return NextResponse.json({ item: created }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, ['QUAN_TRI_HE_THONG', 'QUAN_LY_QC']);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const { entityType, id, updates } = body as {
    entityType?: string;
    id?: string;
    updates?: Record<string, unknown>;
  };

  if (!entityType || !id || !updates) {
    return NextResponse.json({ error: 'Thiếu entityType, id hoặc updates.' }, { status: 400 });
  }

  const res = await mutateDb((db) => {
    const listMap: Record<string, Array<{ id: string }>> = {
      organization: db.organizations,
      user: db.users,
      tempGroup: db.tempGroups,
      product: db.products,
      vehicle: db.vehicles,
      frameworkContract: db.frameworkContracts,
      partnerContract: db.partnerContracts,
    };
    const list = listMap[entityType];
    if (!list) return { error: 'entityType không hợp lệ.', status: 400 };
    const idx = list.findIndex((item) => item.id === id);
    if (idx === -1) return { error: 'Không tìm thấy bản ghi.', status: 404 };

    const before = { ...list[idx] };
    const updated = { ...list[idx], ...updates, id };
    list[idx] = updated;

    appendAuditLog(db, user, {
      action: 'UPDATE_CATALOG',
      entityType,
      entityId: id,
      summary: `Cập nhật danh mục ${entityType} (${id})`,
      beforeJson: before,
      afterJson: updated,
    });
    return { item: updated, status: 200 };
  });

  if ('error' in res) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ item: res.item });
}
