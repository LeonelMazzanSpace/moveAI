'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/client';
import type { NoticeDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';

export function NoticesBell() {
  const { data } = useQuery({ queryKey: ['me', 'notices'], queryFn: () => apiFetch<NoticeDto[]>('/me/notices') });
  const hasNotices = (data?.length ?? 0) > 0;

  return (
    <Link
      href="/perfil#avisos"
      aria-label={hasNotices ? 'Avisos (hay avisos nuevos)' : 'Avisos'}
      className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'relative')}
    >
      <Bell className="size-4" aria-hidden="true" />
      {hasNotices ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-foreground" /> : null}
    </Link>
  );
}
