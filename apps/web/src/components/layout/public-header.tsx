'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { moveButton } from '@/components/move/button-styles';
import { PageContainer } from '@/components/move/page-container';
import type { MeDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { MobileNav } from './mobile-nav';
import {
  BREAKPOINT_CLASSES,
  isNavItemActive,
  PUBLIC_NAV_ITEMS,
  publicAccountItem,
  type NavBreakpoint,
  type NavItem,
} from './nav-items';

export function HeaderNav({ items, breakpoint = 'md' }: { items: NavItem[]; breakpoint?: NavBreakpoint }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'hidden items-center gap-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground',
        BREAKPOINT_CLASSES[breakpoint].show,
      )}
    >
      {items.map((item) => {
        const current = isNavItemActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={cn('inline-flex min-h-8 items-center hover:text-foreground', current && 'text-foreground')}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// The public header carries six links and two buttons, which only fit from `lg`; the other headers fit from `md`.
export function PublicHeader({ user }: { user: Pick<MeDto, 'role'> | null }) {
  const account = publicAccountItem(user);
  const { showInline } = BREAKPOINT_CLASSES.lg;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <PageContainer className="flex h-16 items-center justify-between">
        <Link href="/" className="inline-flex min-h-8 items-center font-display text-xl font-black tracking-tight">
          MOVE<span className="align-super text-[10px]">®</span>
        </Link>
        <HeaderNav items={PUBLIC_NAV_ITEMS} breakpoint="lg" />
        <div className="flex items-center gap-3">
          <Link href={account.href} className={moveButton({ variant: 'outline', className: `hidden ${showInline}` })}>
            {account.label}
          </Link>
          <Link href="/reservar" className={moveButton({ className: `hidden ${showInline}` })}>
            Reservar
          </Link>
          <MobileNav
            items={PUBLIC_NAV_ITEMS}
            actions={[account, { label: 'Reservar', href: '/reservar', primary: true }]}
            breakpoint="lg"
          />
        </div>
      </PageContainer>
    </header>
  );
}
