import type { MeDto } from '@/lib/api/types';

export interface NavItem {
  label: string;
  href: string;
  exact?: boolean;
  showAlerts?: boolean;
  sub?: boolean;
}

/** Width from which a header shows its inline navigation instead of the mobile menu (static strings so Tailwind sees them). */
export type NavBreakpoint = 'md' | 'lg';

export const BREAKPOINT_CLASSES: Record<NavBreakpoint, { show: string; showInline: string; hide: string }> = {
  md: { show: 'md:flex', showInline: 'md:inline-flex', hide: 'md:hidden' },
  lg: { show: 'lg:flex', showInline: 'lg:inline-flex', hide: 'lg:hidden' },
};

export const PUBLIC_NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', href: '/', exact: true },
  { label: 'Equipo', href: '/#equipo', exact: true },
  { label: 'Performance', href: '/performance' },
  { label: 'Rehab', href: '/rehab' },
  { label: 'Recovery', href: '/recovery' },
  { label: 'Planes', href: '/planes' },
];

export const CLIENT_NAV_ITEMS: NavItem[] = [
  { label: 'Mi perfil', href: '/perfil' },
  { label: 'Reservar', href: '/reservar' },
  { label: 'Planes', href: '/planes' },
  { label: 'Historial', href: '/historial' },
];

export const STAFF_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/staff', exact: true },
  { label: 'Clientes', href: '/staff/clientes' },
  { label: 'Turnos y asistencia', href: '/staff/turnos' },
  { label: 'Pagos', href: '/staff/pagos' },
  { label: 'Seguimiento', href: '/staff/seguimiento', exact: true, showAlerts: true },
  { label: 'Check-in', href: '/staff/seguimiento/check-in', sub: true },
  { label: 'Configuración', href: '/staff/configuracion' },
];

export function isNavItemActive(item: NavItem, pathname: string | null): boolean {
  if (!pathname) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function publicAccountItem(user: Pick<MeDto, 'role'> | null): NavItem {
  if (!user) return { label: 'Ingresar', href: '/ingresar' };
  if (user.role === 'staff') return { label: 'Panel', href: '/staff' };
  return { label: 'Mi perfil', href: '/perfil' };
}
