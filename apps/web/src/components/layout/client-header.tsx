'use client';

import Link from 'next/link';
import { PageContainer } from '@/components/move/page-container';
import type { MeDto } from '@/lib/api/types';
import { initials } from '@/lib/format';
import { HeaderNav } from './public-header';
import { LogoutButton } from './logout-button';
import { NoticesBell } from './notices-bell';

const CLIENT_NAV = [
  { label: 'Mi perfil', href: '/perfil' },
  { label: 'Reservar', href: '/reservar' },
  { label: 'Planes', href: '/planes' },
  { label: 'Historial', href: '/historial' },
];

export function ClientHeader({ user }: { user: Pick<MeDto, 'name'> }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <PageContainer className="flex h-16 items-center justify-between">
        <Link href="/perfil" className="font-display text-xl font-black tracking-tight">
          MOVE<span className="align-super text-[10px]">®</span>
        </Link>
        <HeaderNav items={CLIENT_NAV} />
        <div className="flex items-center gap-3">
          <NoticesBell />
          <div className="flex items-center gap-2.5 rounded border border-border bg-card py-1.5 pl-1.5 pr-4">
            <div className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials(user.name)}
            </div>
            <span className="text-xs font-medium">{user.name}</span>
          </div>
          <LogoutButton />
        </div>
      </PageContainer>
    </header>
  );
}
