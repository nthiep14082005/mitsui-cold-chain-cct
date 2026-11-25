import { NextRequest } from 'next/server';
import { forbidImmutable, requireAuth } from '@/lib/auth';

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  return forbidImmutable('Dữ liệu nhiệt độ gốc không thể sửa bởi bất kỳ vai trò nào kể cả Quản trị (NFR-06).');
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  return forbidImmutable('Dữ liệu nhiệt độ gốc không thể sửa bởi bất kỳ vai trò nào kể cả Quản trị (NFR-06).');
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  return forbidImmutable('Dữ liệu nhiệt độ gốc không thể xóa bởi bất kỳ vai trò nào kể cả Quản trị (NFR-06).');
}
