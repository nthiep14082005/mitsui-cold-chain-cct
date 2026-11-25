import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, mutateDb, readDb } from '@/lib/db';
import { isSecureRequest } from '@/lib/auth';
import {
  ADMIN_SESSION_COOKIE,
  CUSTOMER_DEMO_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  FIELD_SESSION_COOKIE,
  isFieldRole,
  isMitsuiRole,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
  verifySessionToken,
} from '@/lib/session-token';
import { User } from '@/types/common';

function sanitizeUser(u: User) {
  // Never expose password hash/plaintext in API payloads
  const { password: _pw, ...safe } = u;
  void _pw;
  return safe;
}

export async function GET(req: NextRequest) {
  const db = await readDb();
  const channel = req.nextUrl.searchParams.get('channel') || 'customer';
  const secure = isSecureRequest(req);

  if (channel === 'admin') {
    const adminPayload = await verifySessionToken(
      req.cookies.get(ADMIN_SESSION_COOKIE)?.value
    );
    const currentUser =
      adminPayload && isMitsuiRole(adminPayload.role)
        ? db.users.find(
            (u) => u.id === adminPayload.userId && u.active && isMitsuiRole(u.role)
          ) ?? null
        : null;

    if (!currentUser) {
      return NextResponse.json({
        currentUser: null,
        currentOrg: null,
        isAuthenticated: false,
        demoUsers: [],
      });
    }

    const currentOrg = db.organizations.find((o) => o.id === currentUser.orgId) ?? null;
    const mitsuiUsers = db.users
      .filter((u) => u.active && isMitsuiRole(u.role))
      .map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        orgId: u.orgId,
        orgName: db.organizations.find((o) => o.id === u.orgId)?.name ?? '',
        phone: u.phone,
        email: u.email,
        twoFactorEnabled: u.twoFactorEnabled,
      }));

    return NextResponse.json({
      currentUser: sanitizeUser(currentUser),
      currentOrg,
      isAuthenticated: true,
      demoUsers: mitsuiUsers,
    });
  }

  if (channel === 'field') {
    const fieldPayload = await verifySessionToken(
      req.cookies.get(FIELD_SESSION_COOKIE)?.value
    );
    let currentUser =
      fieldPayload && isFieldRole(fieldPayload.role)
        ? db.users.find(
            (u) => u.id === fieldPayload.userId && u.active && isFieldRole(u.role)
          ) ?? null
        : null;

    let setCookieToken: string | null = null;
    if (!currentUser) {
      currentUser =
        db.users.find((u) => u.id === 'USER-PACK-MT' && u.active) ??
        db.users.find((u) => isFieldRole(u.role) && u.active) ??
        null;
      if (currentUser) {
        setCookieToken = await signSessionToken(currentUser.id, currentUser.role);
      }
    }

    const currentOrg = currentUser
      ? db.organizations.find((o) => o.id === currentUser.orgId) ?? null
      : null;

    const fieldUsers = db.users
      .filter((u) => u.active && isFieldRole(u.role))
      .map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        orgId: u.orgId,
        orgName: db.organizations.find((o) => o.id === u.orgId)?.name ?? '',
        phone: u.phone,
        email: u.email,
        twoFactorEnabled: u.twoFactorEnabled,
      }));

    const res = NextResponse.json({
      currentUser: currentUser ? sanitizeUser(currentUser) : null,
      currentOrg,
      isAuthenticated: Boolean(fieldPayload),
      demoUsers: fieldUsers,
    });

    if (setCookieToken) {
      res.cookies.set(FIELD_SESSION_COOKIE, setCookieToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
        secure,
      });
    }
    return res;
  }

  // Customer channel: NEVER expose Mitsui / Admin / Field users!
  const cusPayload = await verifySessionToken(
    req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value
  );
  const demoPayload = await verifySessionToken(
    req.cookies.get(CUSTOMER_DEMO_COOKIE)?.value
  );

  let currentUser =
    cusPayload && cusPayload.role === 'KHACH_HANG'
      ? db.users.find((u) => u.id === cusPayload.userId && u.active && u.role === 'KHACH_HANG') ??
        null
      : null;
  const isAuthenticated = Boolean(currentUser);

  let setDemoToken: string | null = null;
  if (!currentUser && demoPayload && demoPayload.role === 'KHACH_HANG') {
    currentUser =
      db.users.find((u) => u.id === demoPayload.userId && u.active && u.role === 'KHACH_HANG') ??
      null;
  }

  if (!currentUser) {
    currentUser =
      db.users.find((u) => u.id === 'USER-CUS-BHX' && u.active) ??
      db.users.find((u) => u.role === 'KHACH_HANG' && u.active) ??
      null;
    if (currentUser) {
      setDemoToken = await signSessionToken(currentUser.id, currentUser.role);
    }
  }

  const currentOrg = currentUser
    ? db.organizations.find((o) => o.id === currentUser.orgId) ?? null
    : null;

  const customerUsers = db.users
    .filter((u) => u.active && u.role === 'KHACH_HANG')
    .map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      orgId: u.orgId,
      orgName: db.organizations.find((o) => o.id === u.orgId)?.name ?? '',
      phone: u.phone,
      email: u.email,
      twoFactorEnabled: u.twoFactorEnabled,
    }));

  const res = NextResponse.json({
    currentUser: currentUser ? sanitizeUser(currentUser) : null,
    currentOrg,
    isAuthenticated,
    demoUsers: customerUsers,
  });

  if (setDemoToken) {
    res.cookies.set(CUSTOMER_DEMO_COOKIE, setDemoToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure,
    });
  }
  return res;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { mode, userId, phone, email, password, otp, scope } = body as {
    mode?:
      | 'ADMIN_LOGIN'
      | 'CUSTOMER_LOGIN'
      | 'SWITCH_CUSTOMER_DEMO'
      | 'SWITCH_ADMIN_ROLE'
      | 'SWITCH_FIELD_ROLE'
      | 'OTP'
      | 'LOGOUT';
    userId?: string;
    phone?: string;
    email?: string;
    password?: string;
    otp?: string;
    scope?: 'admin' | 'customer' | 'field';
  };

  const secure = isSecureRequest(req);

  if (mode === 'LOGOUT') {
    const res = NextResponse.json({ ok: true });
    if (scope === 'admin') {
      res.cookies.set(ADMIN_SESSION_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        secure,
      });
    } else if (scope === 'field') {
      res.cookies.set(FIELD_SESSION_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        secure,
      });
    } else {
      res.cookies.set(CUSTOMER_SESSION_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        secure,
      });
    }
    return res;
  }

  if (mode === 'ADMIN_LOGIN') {
    if (!email?.trim() || !password || !otp?.trim()) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ Email, Mật khẩu và mã OTP 2FA.' },
        { status: 400 }
      );
    }
    if (otp.trim() !== '123456') {
      return NextResponse.json(
        { error: 'Mã OTP xác thực 2 lớp (2FA) không chính xác.' },
        { status: 401 }
      );
    }

    const result = await mutateDb((db) => {
      const target = db.users.find(
        (u) =>
          u.email.toLowerCase() === email.trim().toLowerCase() &&
          u.active &&
          isMitsuiRole(u.role)
      );
      if (!target || target.password !== password) {
        return { error: 'Email hoặc mật khẩu quản trị không chính xác.', status: 401 as const };
      }

      appendAuditLog(db, target, {
        action: 'ADMIN_LOGIN',
        entityType: 'User',
        entityId: target.id,
        summary: `Đăng nhập cổng Quản trị Mitsui: ${target.email} (${target.role})`,
        afterJson: { role: target.role },
      });

      const org = db.organizations.find((o) => o.id === target.orgId) ?? null;
      return { user: target, org, status: 200 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const token = await signSessionToken(result.user.id, result.user.role);
    const res = NextResponse.json({
      currentUser: sanitizeUser(result.user),
      currentOrg: result.org,
      isAuthenticated: true,
    });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure,
    });
    return res;
  }

  if (mode === 'CUSTOMER_LOGIN') {
    if (!email?.trim() || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập Email và Mật khẩu khách hàng B2B.' },
        { status: 400 }
      );
    }

    const result = await mutateDb((db) => {
      const target = db.users.find(
        (u) =>
          u.email.toLowerCase() === email.trim().toLowerCase() &&
          u.active &&
          u.role === 'KHACH_HANG'
      );
      if (!target || target.password !== password) {
        return { error: 'Email hoặc mật khẩu khách hàng không đúng.', status: 401 as const };
      }
      appendAuditLog(db, target, {
        action: 'CUSTOMER_LOGIN',
        entityType: 'User',
        entityId: target.id,
        summary: `Khách hàng B2B đăng nhập: ${target.email}`,
      });
      const org = db.organizations.find((o) => o.id === target.orgId) ?? null;
      return { user: target, org, status: 200 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const token = await signSessionToken(result.user.id, result.user.role);
    const res = NextResponse.json({
      currentUser: sanitizeUser(result.user),
      currentOrg: result.org,
      isAuthenticated: true,
    });
    res.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure,
    });
    return res;
  }

  if (mode === 'SWITCH_ADMIN_ROLE') {
    const existingAdmin = await verifySessionToken(
      req.cookies.get(ADMIN_SESSION_COOKIE)?.value
    );
    if (!existingAdmin || !isMitsuiRole(existingAdmin.role)) {
      return NextResponse.json(
        { error: 'Phiên Quản trị chưa được xác thực. Vui lòng đăng nhập tại /admin.' },
        { status: 401 }
      );
    }
    const db = await readDb();
    const target = db.users.find(
      (u) => u.id === userId && u.active && isMitsuiRole(u.role)
    );
    if (!target) {
      return NextResponse.json({ error: 'Tài khoản nội bộ không hợp lệ.' }, { status: 403 });
    }
    const token = await signSessionToken(target.id, target.role);
    const org = db.organizations.find((o) => o.id === target.orgId) ?? null;
    const res = NextResponse.json({
      currentUser: sanitizeUser(target),
      currentOrg: org,
      isAuthenticated: true,
    });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure,
    });
    return res;
  }

  if (mode === 'SWITCH_CUSTOMER_DEMO') {
    const db = await readDb();
    const target = db.users.find(
      (u) => u.id === userId && u.active && u.role === 'KHACH_HANG'
    );
    if (!target) {
      return NextResponse.json(
        { error: 'Cổng Khách hàng chỉ cho phép chuyển giữa các tài khoản Khách hàng B2B.' },
        { status: 403 }
      );
    }
    const token = await signSessionToken(target.id, target.role);
    const org = db.organizations.find((o) => o.id === target.orgId) ?? null;
    const res = NextResponse.json({
      currentUser: sanitizeUser(target),
      currentOrg: org,
      isAuthenticated: false,
    });
    res.cookies.set(CUSTOMER_DEMO_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure,
    });
    // Clear explicit customer login cookie if switching back to another demo customer
    res.cookies.set(CUSTOMER_SESSION_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      secure,
    });
    return res;
  }

  if (mode === 'SWITCH_FIELD_ROLE' || mode === 'OTP') {
    const db = await readDb();
    let target: User | undefined;
    if (mode === 'OTP') {
      if (!phone || !otp || otp.trim() !== '123456') {
        return NextResponse.json(
          { error: 'Số điện thoại hoặc mã OTP hiện trường không đúng (OTP demo: 123456).' },
          { status: 401 }
        );
      }
      target = db.users.find(
        (u) => u.phone === phone.trim() && u.active && isFieldRole(u.role)
      );
    } else {
      target = db.users.find(
        (u) => u.id === userId && u.active && isFieldRole(u.role)
      );
    }
    if (!target) {
      return NextResponse.json(
        { error: 'Không tìm thấy tài khoản hiện trường hợp lệ.' },
        { status: 403 }
      );
    }
    const token = await signSessionToken(target.id, target.role);
    const org = db.organizations.find((o) => o.id === target.orgId) ?? null;
    const res = NextResponse.json({
      currentUser: sanitizeUser(target),
      currentOrg: org,
      isAuthenticated: true,
    });
    res.cookies.set(FIELD_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure,
    });
    return res;
  }

  return NextResponse.json({ error: 'Chế độ xác thực không được hỗ trợ.' }, { status: 400 });
}
