import { NextResponse, type NextRequest } from 'next/server';
import { isProtectedPath, safeNextPath } from '@/lib/auth/safe-next';

const PATH_HEADER = 'x-move-path';
const SESSION_COOKIES = ['better-auth.session_token', '__Secure-better-auth.session_token'];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
}

function loginRedirect(request: NextRequest, path: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/ingresar';
  url.search = '';
  const next = safeNextPath(path, 'staff') ?? safeNextPath(path, 'client');
  if (next) url.searchParams.set('next', next);
  return NextResponse.redirect(url, 307);
}

export function proxy(request: NextRequest) {
  const path = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (isProtectedPath(path) && !hasSessionCookie(request)) return loginRedirect(request, path);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATH_HEADER, path);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml|css|js|map)$).*)'],
};
