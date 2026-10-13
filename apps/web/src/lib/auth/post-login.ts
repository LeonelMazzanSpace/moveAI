import type { MeDto, Role } from '@/lib/api/types';

const ROLE_HOME: Record<Role, string> = { client: '/perfil', staff: '/staff' };

const CLIENT_AREA_PREFIXES = ['/perfil', '/historial', '/reservar/fisioterapia', '/checkout/plan', '/check-in'];
const AUTH_PREFIXES = ['/ingresar', '/registro', '/recuperar', '/restablecer', '/continuar'];

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function pathnameOf(next: string): string {
  return next.split(/[?#]/)[0] ?? next;
}

function isInternalPath(next: string): boolean {
  return /^\/(?![/\\])[^\u0000-\u001f]*$/.test(next);
}

function isAllowedForRole(role: Role, pathname: string): boolean {
  if (AUTH_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return false;
  if (role === 'client') return !matchesPrefix(pathname, '/staff');
  return matchesPrefix(pathname, '/staff') || !CLIENT_AREA_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function resolvePostLogin(me: MeDto, next: string | null): string {
  if (next && isInternalPath(next) && isAllowedForRole(me.role, pathnameOf(next))) return next;
  return ROLE_HOME[me.role];
}

export function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
