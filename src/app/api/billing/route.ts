import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, pushNotification, readDb } from '@/lib/db';
import {
  calculateCustomerTakeOrPayStatement,
  calculateMonthlyFinancialReport,
  calculatePartnerStatement,
  computeTakeOrPayFormula,
} from '@/domain/billing';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const db = await readDb();

  const month = req.nextUrl.searchParams.get('month') || '2026-11';
  const requestedOrgId = req.nextUrl.searchParams.get('orgId');
  const isMitsui =
    user.role === 'QUAN_LY_QC' ||
    user.role === 'DIEU_PHOI_VIEN' ||
    user.role === 'QUAN_TRI_HE_THONG';

  // NFR-07: Strictly reject cross-org statement queries
  if (requestedOrgId && !isMitsui && requestedOrgId !== user.orgId) {
    return forbidCrossOrg('Không được phép xem bảng kê tài chính của tổ chức khác (NFR-07).');
  }

  let statements = db.statements.filter((s) => s.month === month);
  if (!isMitsui) {
    statements = statements.filter((s) => s.orgId === user.orgId);
  } else if (requestedOrgId) {
    statements = statements.filter((s) => s.orgId === requestedOrgId);
  }

  const financialReport = isMitsui
    ? calculateMonthlyFinancialReport(db, month)
    : null;

  return NextResponse.json({
    month,
    statements,
    financialReport,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['QUAN_LY_QC', 'DIEU_PHOI_VIEN', 'KHACH_HANG']);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const { action, month, unitPriceVndPerKg, committedKg, acceptedDeliveredKg, compensationB } = body as {
    action?: 'RECALCULATE' | 'SIMULATE_TAKE_OR_PAY';
    month?: string;
    unitPriceVndPerKg?: number;
    committedKg?: number;
    acceptedDeliveredKg?: number;
    compensationB?: number;
  };

  if (action === 'SIMULATE_TAKE_OR_PAY') {
    const calc = computeTakeOrPayFormula({
      unitPriceVndPerKg: Number(unitPriceVndPerKg ?? 2800),
      committedKg: Number(committedKg ?? 200000),
      acceptedDeliveredKg: Number(acceptedDeliveredKg ?? 180000),
      compensationB: Number(compensationB ?? 0),
    });
    return NextResponse.json({ simulation: calc });
  }

  if (user.role !== 'QUAN_LY_QC') {
    return NextResponse.json(
      { error: 'Chỉ Quản lý / QC mới được chốt tính lại bảng kê đối soát tháng (FR-40..FR-43).' },
      { status: 403 }
    );
  }

  const targetMonth = month || '2026-11';
  const result = await mutateDb((db) => {
    const rebuilt = [
      ...db.frameworkContracts.map((fc) => {
        const existing = db.statements.find(
          (s) => s.statementType === 'KHACH_HANG' && s.orgId === fc.customerOrgId && s.month === targetMonth
        );
        return calculateCustomerTakeOrPayStatement({
          contract: fc,
          month: targetMonth,
          lots: db.lots,
          epods: db.epods,
          adjustments: db.epodAdjustments,
          claims: db.claims,
          existingStatement: existing,
        });
      }),
      ...db.partnerContracts.map((pc) => {
        const existing = db.statements.find(
          (s) => s.id === `ST-PARTNER-${pc.id}-${targetMonth}`
        );
        return calculatePartnerStatement({
          partnerContract: pc,
          month: targetMonth,
          epods: db.epods,
          adjustments: db.epodAdjustments,
          claims: db.claims,
          existingStatement: existing,
        });
      }),
    ];

    db.statements = [
      ...db.statements.filter((s) => s.month !== targetMonth),
      ...rebuilt,
    ];

    for (const st of rebuilt) {
      if (st.status === 'CHO_XAC_NHAN') {
        pushNotification(db, {
          recipientOrgId: st.orgId,
          channel: ['IN_APP', 'ZALO_ZNS'],
          eventType: 'STATEMENT_READY',
          title: `Bảng kê tháng ${targetMonth} chờ xác nhận`,
          message: `Bảng kê ${st.code}: ${st.netAmountVnd.toLocaleString('vi-VN')} đ.`,
          relatedEntityId: st.id,
        });
      }
    }

    appendAuditLog(db, user, {
      action: 'RECALCULATE_STATEMENTS',
      entityType: 'MonthlyStatement',
      entityId: targetMonth,
      summary: `Tính lại ${rebuilt.length} bảng kê đối soát tháng ${targetMonth} (Take-or-Pay & Đối tác)`,
    });

    return { statements: rebuilt, financialReport: calculateMonthlyFinancialReport(db, targetMonth) };
  });

  return NextResponse.json(result);
}
