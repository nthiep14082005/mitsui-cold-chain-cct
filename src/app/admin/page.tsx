import { AdminLoginCard } from '@/components/auth/AdminLoginCard';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  return <AdminLoginCard nextUrl={sp.next || '/control-tower/admin'} />;
}
