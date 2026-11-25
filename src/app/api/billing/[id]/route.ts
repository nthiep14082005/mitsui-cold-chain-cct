import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, hasOrgAccess, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, readDb } from '@/lib/db';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await context.params;
  const db = await readDb();

  const st = db.statements.find((s) => s.id === id);
  if (!st) return NextResponse.json({ error: 'Không tìm thấy bảng kê.' }, { status: 404 });

  if (!hasOrgAccess(user, [st.orgId], { allowSystemAdmin: true })) {
    return forbidCrossOrg('Không được phép xem bảng kê của tổ chức khác (NFR-07).');
  }
  return NextResponse.json({ statement: st });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await context.params;

  if (user.role === 'QUAN_TRI_HE_THONG') {
    return forbidCrossOrg();
  }

  const result = await mutateDb((db) => {
    const st = db.statements.find((s) => s.id === id);
    if (!st) return { error: 'Không tìm thấy bảng kê.', status: 404 };

    if (!hasOrgAccess(user, [st.orgId])) {
      return { error: 'Không được phép xác nhận bảng kê của tổ chức khác (NFR-07).', status: 403 };
    }

    st.status = 'DA_XAC_NHAN';
    st.confirmedByUserId = user.id;
    st.confirmedAt = new Date().toISOString();

    appendAuditLog(db, user, {
      action: 'CONFIRM_STATEMENT',
      entityType: 'MonthlyStatement',
      entityId: st.id,
      summary: `Xác nhận bảng kê ${st.code} (${st.netAmountVnd.toLocaleString('vi-VN')} đ)`,
      afterJson: { status: st.status, confirmedAt: st.confirmedAt },
    });
    return { statement: st, status: 200 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ statement: result.statement });
}
