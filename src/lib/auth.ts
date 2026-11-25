import { NextRequest, NextResponse } from 'next/server';
import { User, UserRole } from '@/types/common';
import { CctDatabase } from '@/types/claim-billing-kpi';
import { readDb } from './db';
import {
  ADMIN_SESSION_COOKIE,
  CUSTOMER_DEMO_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  FIELD_SESSION_COOKIE,
  isFieldRole,
  isMitsuiRole,
  verifySessionToken,
} from './session-token';

export function isSecureRequest(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto');
  if (proto) return proto.includes('https');
  return req.nextUrl.protocol === 'https:';
}

function inferChannel(req: NextRequest): 'admin' | 'customer' | 'field' | 'auto' {
  const headerChannel = req.headers.get('x-cct-channel');
  if (headerChannel === 'admin' || headerChannel === 'customer' || headerChannel === 'field') {
    return headerChannel;
  }
  const path = req.nextUrl.pathname;
  if (path.startsWith('/api/admin')) return 'admin';

  const referer = req.headers.get('referer') || '';
  if (referer.includes('/control-tower') || referer.includes('/admin')) return 'admin';
  if (referer.includes('/field-app')) return 'field';
  if (referer.includes('/customer')) return 'customer';
  return 'auto';
}

/**
 * Resolves the authenticated user STRICTLY from HMAC-signed HttpOnly cookies.
 * Never accepts unverified headers such as x-cct-user-id.
 */
export async function getRequestUser(
  req: NextRequest,
  db?: CctDatabase
): Promise<User | null> {
  const database = db ?? (await readDb());
  const channel = inferChannel(req);

  const findActiveUser = (userId: string, predicate?: (u: User) => boolean): User | null => {
    const u = database.users.find((item) => item.id === userId && item.active);
    if (!u) return null;
    if (predicate && !predicate(u)) return null;
    return u;
  };

  if (channel === 'admin') {
    const adminToken = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const payload = await verifySessionToken(adminToken);
    if (!payload || !isMitsuiRole(payload.role)) return null;
    return findActiveUser(payload.userId, (u) => isMitsuiRole(u.role));
  }

  if (channel === 'customer') {
    const cusToken = req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
    const cusPayload = await verifySessionToken(cusToken);
    if (cusPayload && cusPayload.role === 'KHACH_HANG') {
      return findActiveUser(cusPayload.userId, (u) => u.role === 'KHACH_HANG');
    }
    const demoToken = req.cookies.get(CUSTOMER_DEMO_COOKIE)?.value;
    const demoPayload = await verifySessionToken(demoToken);
    if (demoPayload && demoPayload.role === 'KHACH_HANG') {
      return findActiveUser(demoPayload.userId, (u) => u.role === 'KHACH_HANG');
    }
    return null;
  }

  if (channel === 'field') {
    const fieldToken = req.cookies.get(FIELD_SESSION_COOKIE)?.value;
    const fieldPayload = await verifySessionToken(fieldToken);
    if (fieldPayload && isFieldRole(fieldPayload.role)) {
      return findActiveUser(fieldPayload.userId, (u) => isFieldRole(u.role));
    }
    return null;
  }

  // Auto priority when called from scripts/API tests with cookie jar
  const cookieOrder: Array<{ name: string; check: (r: UserRole) => boolean }> = [
    { name: ADMIN_SESSION_COOKIE, check: isMitsuiRole },
    { name: CUSTOMER_SESSION_COOKIE, check: (r) => r === 'KHACH_HANG' },
    { name: CUSTOMER_DEMO_COOKIE, check: (r) => r === 'KHACH_HANG' },
    { name: FIELD_SESSION_COOKIE, check: isFieldRole },
  ];

  for (const item of cookieOrder) {
    const raw = req.cookies.get(item.name)?.value;
    const payload = await verifySessionToken(raw);
    if (payload && item.check(payload.role)) {
      const user = findActiveUser(payload.userId, (u) => item.check(u.role));
      if (user) return user;
    }
  }

  return null;
}

/**
 * Verifies authentication and optional role membership; returns either user or NextResponse 401/403.
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles?: UserRole[]
): Promise<{ user: User; error?: never } | { user?: never; error: NextResponse }> {
  const db = await readDb();
  const user = await getRequestUser(req, db);
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.' },
        { status: 401 }
      ),
    };
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      error: NextResponse.json(
        {
          error: `Vai trò ${user.role} không có quyền thực hiện thao tác này (NFR-07).`,
        },
        { status: 403 }
      ),
    };
  }
  return { user };
}

/**
 * NFR-07: Enforces strict cross-organization data isolation.
 */
export function hasOrgAccess(
  user: User,
  resourceOwnerOrgIds: Array<string | undefined>,
  options?: { allowMitsuiCoordinator?: boolean; allowSystemAdmin?: boolean }
): boolean {
  const allowCoord = options?.allowMitsuiCoordinator ?? true;
  const allowAdmin = options?.allowSystemAdmin ?? false;

  if (user.role === 'QUAN_LY_QC') return true;
  if (user.role === 'DIEU_PHOI_VIEN') return allowCoord;
  if (user.role === 'QUAN_TRI_HE_THONG') return allowAdmin;

  const validOwners = resourceOwnerOrgIds.filter(Boolean) as string[];
  return validOwners.includes(user.orgId);
}

export function forbidCrossOrg(
  detail = 'Không được phép truy cập dữ liệu của tổ chức khác (NFR-07).'
) {
  return NextResponse.json({ error: detail }, { status: 403 });
}

export function forbidImmutable(
  detail = 'Bản ghi gốc (ePOD / Nhiệt độ / Phán quyết) là bất biến, không thể sửa hoặc xóa (NFR-06). Vui lòng tạo biên bản điều chỉnh.'
) {
  return NextResponse.json({ error: detail }, { status: 403 });
}
