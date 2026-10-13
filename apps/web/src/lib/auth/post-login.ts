import type { MeDto, Role } from '@/lib/api/types';
import { safeNextPath } from './safe-next';

const ROLE_HOME: Record<Role, string> = { client: '/perfil', staff: '/staff' };

const AUTH_PREFIXES = ['/ingresar', '/registro', '/recuperar', '/restablecer', '/continuar'];

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function pathnameOf(next: string): string {
  return next.split(/[?#]/)[0] ?? next;
}

export function resolvePostLogin(me: MeDto, next: string | null): string {
  const safeNext = safeNextPath(next, me.role);
  if (!safeNext || AUTH_PREFIXES.some((prefix) => matchesPrefix(pathnameOf(safeNext), prefix))) return ROLE_HOME[me.role];
  return safeNext;
}

export function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
