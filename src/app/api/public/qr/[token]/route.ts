import { NextRequest, NextResponse } from 'next/server';
import { readDb } from '@/lib/db';
import { buildPublicQrPayload } from '@/domain/kpi-scoring';

/**
 * FR-48, FR-49, FR-50, BR-15: Public unauthenticated consumer QR endpoint.
 * Strictly returns ONLY whitelisted public traceability fields.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const db = await readDb();

  const lot = db.lots.find((l) => l.qrToken === token);
  if (!lot) {
    return NextResponse.json(
      { error: 'Không tìm thấy thông tin truy xuất cho mã QR này.' },
      { status: 404 }
    );
  }

  const payload = buildPublicQrPayload(lot, db);
  return NextResponse.json(payload);
}
