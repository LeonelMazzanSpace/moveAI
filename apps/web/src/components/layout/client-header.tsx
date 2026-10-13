'use client';

import Link from 'next/link';
import { PageContainer } from '@/components/move/page-container';
import type { MeDto } from '@/lib/api/types';
import { initials } from '@/lib/format';
import { HeaderNav } from './public-header';
import { LogoutButton } from './logout-button';
import { MobileNav, MobileNavAccount } from './mobile-nav';
import { CLIENT_NAV_ITEMS } from './nav-items';
import { NoticesBell } from './notices-bell';

export function ClientHeader({ user }: { user: Pick<MeDto, 'name'> }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <PageContainer className="flex h-16 items-center justify-between">
        <Link href="/perfil" className="font-display text-xl font-black tracking-tight">
          MOVE<span className="align-super text-[10px]">®</span>
        </Link>
        <HeaderNav items={CLIENT_NAV_ITEMS} />
        <div className="flex items-center gap-3">
          <NoticesBell />
          <div className="hidden items-center gap-2.5 rounded border border-border bg-card py-1.5 pl-1.5 pr-4 md:flex">
            <div className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials(user.name)}
            </div>
            <span className="text-xs font-medium">{user.name}</span>
          </div>
          <LogoutButton className="hidden md:inline-flex" />
          <MobileNav items={CLIENT_NAV_ITEMS} footer={<MobileNavAccount name={user.name} />} />
        </div>
      </PageContainer>
    </header>
  );
}
