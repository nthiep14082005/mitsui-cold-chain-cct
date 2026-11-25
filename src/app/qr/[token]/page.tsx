import React from 'react';
import { notFound } from 'next/navigation';
import { readDb } from '@/lib/db';
import { buildPublicQrPayload } from '@/domain/kpi-scoring';
import { PublicQrClientView } from '@/components/modules/qr/PublicQrClientView';

export const dynamic = 'force-dynamic';

/**
 * Channel 4: Public Consumer QR Traceability Page (FR-48, FR-49, FR-50, BR-15).
 * No login required. Strictly passes ONLY sanitized public fields to client view.
 */
export default async function PublicQrTracePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await readDb();
  const lot = db.lots.find((l) => l.qrToken === token);
  if (!lot) {
    notFound();
  }

  const info = buildPublicQrPayload(lot, db);
  return <PublicQrClientView info={info} />;
}
