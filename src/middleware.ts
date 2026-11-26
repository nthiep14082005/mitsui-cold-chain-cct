import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Root "/" redirects directly to Customer B2B portal
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/customer', req.url));
  }

  // 2. /admin goes straight into /control-tower/admin (or ?next=...) without login gate
  if (pathname === '/admin') {
    const nextParam = req.nextUrl.searchParams.get('next');
    const target =
      nextParam && nextParam.startsWith('/control-tower')
        ? nextParam
        : '/control-tower/admin';
    return NextResponse.redirect(new URL(target, req.url));
  }

  // 3. /control-tower and all sub-routes are directly accessible
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin', '/control-tower', '/control-tower/:path*'],
};
