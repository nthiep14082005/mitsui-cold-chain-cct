import { LotDossierPanel } from '@/components/modules/epod/LotDossierPanel';

export default async function ControlTowerLotsPage({
  searchParams,
}: {
  searchParams: Promise<{ lotId?: string }>;
}) {
  const sp = await searchParams;
  return <LotDossierPanel initialLotId={sp.lotId} />;
}
