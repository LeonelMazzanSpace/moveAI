import type { Role } from '@/lib/api/types';

const UNSAFE_CHARS = /[\u0000-\u001f\u007f\\]/;

const CLIENT_ONLY_ROUTES = ['/perfil', '/historial', '/check-in', '/reservar/fisioterapia', '/checkout/plan'];

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isInternal(next: string): boolean {
  return next.startsWith('/') && !next.startsWith('//') && !UNSAFE_CHARS.test(next);
}

function normalizePathname(pathname: string): string {
  const segments: string[] = [];
  for (const segment of pathname.split('/').slice(1)) {
    const dots = segment.toLowerCase().replaceAll('%2e', '.');
    if (dots === '..') segments.pop();
    else if (dots !== '.') segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

function normalize(next: string): string {
  const rawPathname = next.split(/[?#]/)[0];
  return `${normalizePathname(rawPathname)}${next.slice(rawPathname.length)}`;
}

export function safeNextPath(rawNext: string | null | undefined, role: Role): string | null {
  if (!rawNext || !isInternal(rawNext)) return null;

  const next = normalize(rawNext);
  if (!isInternal(next)) return null;

  const pathname = next.split(/[?#]/)[0];
  const isStaffRoute = matchesRoute(pathname, '/staff');
  const isClientRoute = CLIENT_ONLY_ROUTES.some((route) => matchesRoute(pathname, route));

  if (role === 'client' && isStaffRoute) return null;
  if (role === 'staff' && isClientRoute) return null;
  return next;
}
