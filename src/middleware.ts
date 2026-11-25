import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  isMitsuiRole,
  verifySessionToken,
} from '@/lib/session-token';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Root "/" redirects directly to Customer B2B portal without touching Admin session
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/customer', req.url));
  }

  // 2. Protect /control-tower and all sub-routes
  if (pathname.startsWith('/control-tower')) {
    const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const payload = await verifySessionToken(token);
    if (!payload || !isMitsuiRole(payload.role)) {
      const loginUrl = new URL('/admin', req.url);
      loginUrl.searchParams.set('next', pathname + search);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 3. /admin auto-redirects into /control-tower/admin (or ?next=...) if Admin session is already valid
  if (pathname === '/admin') {
    const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const payload = await verifySessionToken(token);
    if (payload && isMitsuiRole(payload.role)) {
      const nextParam = req.nextUrl.searchParams.get('next');
      const target =
        nextParam && nextParam.startsWith('/control-tower')
          ? nextParam
          : '/control-tower/admin';
      return NextResponse.redirect(new URL(target, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin', '/control-tower', '/control-tower/:path*'],
};
