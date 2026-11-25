import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, forbidImmutable, hasOrgAccess, requireAuth } from '@/lib/auth';
import { readDb } from '@/lib/db';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await context.params;
  const db = await readDb();

  const epod = db.epods.find((e) => e.id === id);
  if (!epod) return NextResponse.json({ error: 'Không tìm thấy biên bản ePOD.' }, { status: 404 });

  if (!hasOrgAccess(user, [epod.senderOrgId, epod.receiverOrgId], { allowSystemAdmin: true })) {
    return forbidCrossOrg();
  }

  const adjustments = db.epodAdjustments.filter((a) => a.originalEpodId === epod.id);
  return NextResponse.json({ epod, adjustments });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  return forbidImmutable('Biên bản ePOD đã ghi không thể sửa bởi bất kỳ vai trò nào kể cả Quản trị (NFR-06, FR-34). Vui lòng tạo Biên bản điều chỉnh.');
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  return forbidImmutable('Biên bản ePOD đã ghi không thể sửa bởi bất kỳ vai trò nào kể cả Quản trị (NFR-06, FR-34). Vui lòng tạo Biên bản điều chỉnh.');
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  return forbidImmutable('Biên bản ePOD đã ghi không thể xóa bởi bất kỳ vai trò nào kể cả Quản trị (NFR-06, FR-34).');
}
