import { Suspense, type ReactNode } from 'react';
import { PublicFooter } from '@/components/layout/public-footer';
import { PublicHeader } from '@/components/layout/public-header';
import { getCurrentUser } from '@/lib/auth/session';

async function SessionAwareHeader() {
  const user = await getCurrentUser().catch(() => null);
  return <PublicHeader user={user} />;
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<PublicHeader user={null} />}>
        <SessionAwareHeader />
      </Suspense>
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </>
  );
}
