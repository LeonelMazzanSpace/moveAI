'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { withNext } from '@/lib/auth/post-login';

type AuthTab = 'login' | 'register';

const TABS: { id: AuthTab; label: string; path: string }[] = [
  { id: 'login', label: 'Iniciar sesión', path: '/ingresar' },
  { id: 'register', label: 'Crear cuenta', path: '/registro' },
];

export function AuthTabs({ active }: { active: AuthTab }) {
  const next = useSearchParams().get('next');

  return (
    <nav
      aria-label="Acceso"
      className="mt-10 grid grid-cols-2 rounded bg-soft p-1 text-center text-[11px] font-semibold uppercase tracking-[0.2em]"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={withNext(tab.path, next)}
          aria-current={tab.id === active ? 'page' : undefined}
          className={cn('rounded py-2.5', tab.id === active ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground')}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
