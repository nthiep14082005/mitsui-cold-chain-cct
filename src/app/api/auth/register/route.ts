import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, mutateDb } from '@/lib/db';
import { isSecureRequest } from '@/lib/auth';
import {
  CUSTOMER_SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
} from '@/lib/session-token';
import { Organization, User } from '@/types/common';
import { FrameworkContract } from '@/types/catalog';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, companyName, email, phone, password } = body as {
    name?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    password?: string;
  };

  if (
    !name?.trim() ||
    !companyName?.trim() ||
    !email?.trim() ||
    !phone?.trim() ||
    !password ||
    password.length < 6
  ) {
    return NextResponse.json(
      { error: 'Vui lòng nhập đầy đủ Họ tên, Tên doanh nghiệp, Email, SĐT và Mật khẩu (>= 6 ký tự).' },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const result = await mutateDb((db) => {
    const exists = db.users.some((u) => u.email.toLowerCase() === normalizedEmail);
    if (exists) {
      return { error: `Email ${normalizedEmail} đã được đăng ký trong hệ thống.`, status: 409 as const };
    }

    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orgId = `ORG-CUS-${suffix}`;
    const userId = `USER-CUS-${suffix}`;
    const contractId = `FC-${suffix}`;

    const org: Organization = {
      id: orgId,
      code: `CUS-${suffix.slice(0, 4)}`,
      name: companyName.trim(),
      type: 'KHACH_HANG',
      taxCode: `03${Math.floor(10000000 + Math.random() * 89999999)}`,
      address: 'TP.HCM',
      province: 'TP.HCM',
      allowPublicName: true,
      baselineLossPct: 30,
      contractRenewed: true,
    };

    const user: User = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: phone.trim(),
      zalo: phone.trim(),
      role: 'KHACH_HANG',
      orgId,
      active: true,
      twoFactorEnabled: false,
    };

    const contract: FrameworkContract = {
      id: contractId,
      code: `HDK-${suffix}`,
      customerOrgId: orgId,
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
      allowedProductIds: db.products.map((p) => p.id),
      committedTonsPerMonth: 100,
      unitPriceVndPerKg: 2800,
      compensationRateVndPerKg: 18000,
      slaOtdPct: 95,
      slaTempPct: 98,
      claimWindowHours: 24,
      deliveryPoints: [
        {
          id: `DP-${suffix}-1`,
          name: `Kho trung tâm ${companyName.trim()}`,
          address: 'TP.HCM',
        },
      ],
      status: 'ACTIVE',
    };

    db.organizations.push(org);
    db.users.push(user);
    db.frameworkContracts.push(contract);

    appendAuditLog(db, user, {
      action: 'REGISTER_B2B_CUSTOMER',
      entityType: 'Organization',
      entityId: org.id,
      summary: `Khách hàng B2B mới đăng ký: ${org.name} (${user.email})`,
      afterJson: { orgId: org.id, contractCode: contract.code },
    });

    return { user, org, contract, status: 201 as const };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const token = await signSessionToken(result.user.id, result.user.role);
  const { password: _pw, ...safeUser } = result.user;
  void _pw;

  const res = NextResponse.json(
    {
      currentUser: safeUser,
      currentOrg: result.org,
      contract: result.contract,
      isAuthenticated: true,
    },
    { status: 201 }
  );

  res.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: isSecureRequest(req),
  });
  return res;
}
