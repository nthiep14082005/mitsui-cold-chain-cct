import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, readDb } from '@/lib/db';
import { calculateMonthlyPartnerScores, calculatePilotKpis } from '@/domain/kpi-scoring';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const db = await readDb();

  const month = req.nextUrl.searchParams.get('month') || '2026-11';
  const customerOrgId = req.nextUrl.searchParams.get('customerOrgId') || undefined;
  const partnerOrgId = req.nextUrl.searchParams.get('partnerOrgId') || undefined;
  const tempGroupId = req.nextUrl.searchParams.get('tempGroupId') || undefined;

  if (user.role === 'KHACH_HANG') {
    if (customerOrgId && customerOrgId !== user.orgId) {
      return forbidCrossOrg();
    }
    const customerKpi = calculatePilotKpis(db, {
      month,
      customerOrgId: user.orgId,
      tempGroupId,
    });
    return NextResponse.json({
      kpiData: {
        ...customerKpi,
        // NFR-07: Do not leak Mitsui internal profit or other customers' financials
        summary: {
          totalLotsEvaluated: customerKpi.summary.totalLotsEvaluated,
          totalBg5Kg: customerKpi.summary.totalBg5Kg,
          totalAcceptedKg: customerKpi.summary.totalAcceptedKg,
        },
        metrics: customerKpi.metrics.filter((m) =>
          ['loss_reduction', 'accepted_rate', 'otd', 'temp_compliance'].includes(m.key)
        ),
      },
      partnerScores: [],
    });
  }

  const kpiData = calculatePilotKpis(db, {
    month,
    customerOrgId,
    partnerOrgId,
    tempGroupId,
  });

  const partnerScores = db.partnerScores.filter(
    (ps) => !partnerOrgId || ps.partnerOrgId === partnerOrgId
  );

  return NextResponse.json({ kpiData, partnerScores });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['QUAN_LY_QC', 'DIEU_PHOI_VIEN']);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const month = (body.month as string) || '2026-11';

  const scores = await mutateDb((db) => {
    const calculated = calculateMonthlyPartnerScores(db, month);
    db.partnerScores = [
      ...db.partnerScores.filter((ps) => ps.month !== month),
      ...calculated,
    ];
    appendAuditLog(db, user, {
      action: 'RECALCULATE_PARTNER_SCORES',
      entityType: 'PartnerScoreRecord',
      entityId: month,
      summary: `Chấm điểm đối tác tháng ${month} theo trọng số BR-14`,
      afterJson: calculated.map((c) => ({ partnerOrgId: c.partnerOrgId, totalScore: c.totalScore, flag: c.contractReviewFlag })),
    });
    return calculated;
  });

  return NextResponse.json({ partnerScores: scores });
}
