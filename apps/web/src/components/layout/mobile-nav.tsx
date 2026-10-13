'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { LogoutButton } from './logout-button';
import { isNavItemActive, STAFF_NAV_ITEMS, type NavItem } from './nav-items';
import { useStaffAlertsTotal } from './staff-sidebar';

interface MobileNavProps {
  items: NavItem[];
  alertsTotal?: number;
  actions?: (NavItem & { primary?: boolean })[];
  footer?: ReactNode;
  className?: string;
}

export function MobileNav({ items, alertsTotal = 0, actions = [], footer, className }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="icon" aria-label="Abrir menú" className={cn('md:hidden', className)} />}
      >
        <Menu aria-hidden="true" />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="top-4 max-h-[calc(100dvh-2rem)] -translate-y-0 overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <DialogTitle className="text-xs font-semibold uppercase tracking-[0.2em]">Menú</DialogTitle>
          <DialogClose render={<Button variant="ghost" size="sm" />}>Cerrar menú</DialogClose>
        </div>
        <nav aria-label="Menú principal" className="space-y-1 text-sm font-medium text-muted-foreground">
          {items.map((item) => {
            const active = isNavItemActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
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
        {actions.length > 0 ? (
          <div className="flex flex-col gap-2">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                onClick={close}
                className={buttonVariants({ variant: action.primary ? 'default' : 'outline', size: 'lg' })}
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
        {footer}
      </DialogContent>
    </Dialog>
  );
}

export function MobileNavAccount({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
      <span className="min-w-0 truncate text-xs font-medium">{name}</span>
      <LogoutButton />
    </div>
  );
}

export function StaffMobileNav({ name }: { name: string }) {
  const alertsTotal = useStaffAlertsTotal();
  return (
    <MobileNav items={STAFF_NAV_ITEMS} alertsTotal={alertsTotal} footer={<MobileNavAccount name={name} />} />
  );
}
