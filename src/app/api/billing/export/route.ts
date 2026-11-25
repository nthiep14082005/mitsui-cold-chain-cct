import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, hasOrgAccess, requireAuth } from '@/lib/auth';
import { generateStatementCsv } from '@/lib/csv';
import { readDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const db = await readDb();

  const statementId = req.nextUrl.searchParams.get('statementId');
  if (!statementId) {
    return NextResponse.json({ error: 'Thiếu statementId.' }, { status: 400 });
  }

  const st = db.statements.find((s) => s.id === statementId);
  if (!st) return NextResponse.json({ error: 'Không tìm thấy bảng kê.' }, { status: 404 });

  if (!hasOrgAccess(user, [st.orgId], { allowSystemAdmin: true })) {
    return forbidCrossOrg('Không được phép xuất bảng kê của tổ chức khác (NFR-07).');
  }

  const orgName = db.organizations.find((o) => o.id === st.orgId)?.name ?? st.orgId;
  const csv = generateStatementCsv(st, orgName);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${st.code}.csv"`,
    },
  });
}
