import type { Role } from '@/lib/api/types';

const UNSAFE_CHARS = /[\u0000-\u001f\u007f\\]/;

const CLIENT_ONLY_ROUTES = ['/perfil', '/historial', '/check-in', '/reservar/fisioterapia', '/checkout/plan'];

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isInternal(next: string): boolean {
  return next.startsWith('/') && !next.startsWith('//') && !UNSAFE_CHARS.test(next);
}

export function safeNextPath(next: string | null | undefined, role: Role): string | null {
  if (!next || !isInternal(next)) return null;

  const pathname = next.split(/[?#]/)[0];
  const isStaffRoute = matchesRoute(pathname, '/staff');
  const isClientRoute = CLIENT_ONLY_ROUTES.some((route) => matchesRoute(pathname, route));

  if (role === 'client' && isStaffRoute) return null;
  if (role === 'staff' && isClientRoute) return null;
  return next;
}
