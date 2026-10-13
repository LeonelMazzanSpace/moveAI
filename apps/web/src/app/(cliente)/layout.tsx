import { Suspense, type ReactNode } from 'react';
import { ClientHeader } from '@/components/layout/client-header';
import { requireRole } from '@/lib/auth/session';

const CLIENT_AREA_PATH = '/perfil';

async function ClientShell({ children }: { children: ReactNode }) {
  const user = await requireRole('client', CLIENT_AREA_PATH);
  return (
    <>
      <ClientHeader user={user} />
      <main className="flex-1">{children}</main>
    </>
  );
}

export default function ClientAreaLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ClientShell>{children}</ClientShell>
    </Suspense>
  );
}
