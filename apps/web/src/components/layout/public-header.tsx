'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PageContainer } from '@/components/move/page-container';
import type { MeDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { MobileNav } from './mobile-nav';
import { isNavItemActive, PUBLIC_NAV_ITEMS, publicAccountItem, type NavItem } from './nav-items';

const BUTTON_CLASSES =
  'rounded px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]';

export function HeaderNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground md:flex">
      {items.map((item) => {
        const current = isNavItemActive(item, pathname);
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

export function PublicHeader({ user }: { user: Pick<MeDto, 'role'> | null }) {
  const account = publicAccountItem(user);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <PageContainer className="flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-xl font-black tracking-tight">
          MOVE<span className="align-super text-[10px]">®</span>
        </Link>
        <HeaderNav items={PUBLIC_NAV_ITEMS} />
        <div className="flex items-center gap-3">
          <Link
            href={account.href}
            className={cn(BUTTON_CLASSES, 'hidden border border-border text-foreground hover:bg-card md:inline-block')}
          >
            {account.label}
          </Link>
          <Link
            href="/reservar"
            className={cn(BUTTON_CLASSES, 'hidden bg-primary text-primary-foreground hover:bg-primary/80 md:inline-block')}
          >
            Reservar
          </Link>
          <MobileNav
            items={PUBLIC_NAV_ITEMS}
            actions={[account, { label: 'Reservar', href: '/reservar', primary: true }]}
          />
        </div>
      </PageContainer>
    </header>
  );
}
