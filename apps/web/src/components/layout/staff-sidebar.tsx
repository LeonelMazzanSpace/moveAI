'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import type { AlertCountsDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';

interface SidebarItem {
  label: string;
  href: string;
  exact?: boolean;
  showAlerts?: boolean;
  sub?: boolean;
}

const ITEMS: SidebarItem[] = [
  { label: 'Dashboard', href: '/staff', exact: true },
  { label: 'Clientes', href: '/staff/clientes' },
  { label: 'Turnos y asistencia', href: '/staff/turnos' },
  { label: 'Pagos', href: '/staff/pagos' },
  { label: 'Seguimiento', href: '/staff/seguimiento', exact: true, showAlerts: true },
  { label: 'Check-in', href: '/staff/seguimiento/check-in', sub: true },
  { label: 'Configuración', href: '/staff/configuracion' },
];

function isActive(item: SidebarItem, pathname: string | null): boolean {
  if (!pathname) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function StaffSidebar() {
  const pathname = usePathname();
  const { data: counts } = useQuery({
    queryKey: ['staff', 'alert-counts'],
    queryFn: () => apiFetch<AlertCountsDto>('/staff/alerts/counts'),
    refetchInterval: 60_000,
  });
  const alertsTotal = counts?.total ?? 0;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-border bg-soft md:block">
      <div className="flex h-16 items-center border-b border-border px-6">
        <span className="font-display text-lg font-black tracking-tight">
          MOVE<span className="align-super text-[9px]">®</span>
        </span>
        <span className="ml-2 rounded border border-border bg-card px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Staff
        </span>
      </div>
      <nav className="space-y-1 p-4 text-xs font-medium text-muted-foreground">
        {ITEMS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center justify-between rounded px-3 py-2.5 hover:bg-card hover:text-foreground',
                item.sub && 'ml-4 py-2',
                active && 'bg-card text-foreground',
              )}
            >
              {item.label}
              {item.showAlerts && alertsTotal > 0 ? (
                <span className="rounded-full bg-danger-muted px-2 py-0.5 text-[10px] font-semibold text-danger">
                  {alertsTotal}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
