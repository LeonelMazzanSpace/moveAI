'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PageContainer } from '@/components/move/page-container';
import type { MeDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
}

const PUBLIC_NAV: NavItem[] = [
  { label: 'Inicio', href: '/' },
  { label: 'Performance', href: '/performance' },
  { label: 'Rehab', href: '/rehab' },
  { label: 'Recovery', href: '/recovery' },
  { label: 'Planes', href: '/planes' },
];

const BUTTON_CLASSES =
  'rounded px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]';

function isCurrent(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground md:flex">
      {items.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={cn('hover:text-foreground', current && 'text-foreground')}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function accountLink(user: Pick<MeDto, 'role'> | null): NavItem {
  if (!user) return { label: 'Ingresar', href: '/ingresar' };
  if (user.role === 'staff') return { label: 'Panel', href: '/staff' };
  return { label: 'Mi perfil', href: '/perfil' };
}

export function PublicHeader({ user }: { user: Pick<MeDto, 'role'> | null }) {
  const account = accountLink(user);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <PageContainer className="flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-xl font-black tracking-tight">
          MOVE<span className="align-super text-[10px]">®</span>
        </Link>
        <HeaderNav items={PUBLIC_NAV} />
        <div className="flex items-center gap-3">
          <Link
            href={account.href}
            className={cn(BUTTON_CLASSES, 'border border-border text-foreground hover:bg-card')}
          >
            {account.label}
          </Link>
          <Link
            href="/reservar"
            className={cn(BUTTON_CLASSES, 'bg-primary text-primary-foreground hover:bg-primary/80')}
          >
            Reservar
          </Link>
        </div>
      </PageContainer>
    </header>
  );
}
