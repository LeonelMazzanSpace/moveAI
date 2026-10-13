import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClientsView } from '@/components/staff/clientes/clients-view';

export const metadata: Metadata = { title: 'Clientes' };

export default function ClientsPage() {
  return (
    <Suspense fallback={null}>
      <ClientsView />
    </Suspense>
  );
}
