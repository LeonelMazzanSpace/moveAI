import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageContainer } from '@/components/move/page-container';

export const metadata: Metadata = {
  title: 'Acceso',
  robots: { index: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-background">
        <PageContainer className="flex h-16 items-center justify-between">
          <Link href="/" className="inline-flex min-h-8 items-center font-display text-xl font-black tracking-tight">
            MOVE<span className="align-super text-[10px]">®</span>
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-8 items-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            ← Volver al sitio
          </Link>
        </PageContainer>
      </header>
      <main>
        <PageContainer className="py-16">{children}</PageContainer>
      </main>
    </>
  );
}
