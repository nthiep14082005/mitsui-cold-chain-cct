import { redirect } from 'next/navigation';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const target =
    sp.next && sp.next.startsWith('/control-tower')
      ? sp.next
      : '/control-tower/admin';
  redirect(target);
}
