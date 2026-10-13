'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import type { AlertCountsDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { isNavItemActive, STAFF_NAV_ITEMS } from './nav-items';

export function useStaffAlertsTotal(): number {
  const { data: counts } = useQuery({
    queryKey: ['staff', 'alert-counts'],
    queryFn: () => apiFetch<AlertCountsDto>('/staff/alerts/counts'),
    refetchInterval: 60_000,
  });
  return counts?.total ?? 0;
}

export function StaffSidebar() {
  const pathname = usePathname();
  const alertsTotal = useStaffAlertsTotal();

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
        {STAFF_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item, pathname);
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
