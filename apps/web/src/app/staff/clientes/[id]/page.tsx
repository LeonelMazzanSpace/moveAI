import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClientDetail } from '@/components/staff/clientes/client-detail';

export const metadata: Metadata = { title: 'Cliente' };

type Params = Promise<{ id: string }>;

async function ClientDetailLoader({ params }: { params: Params }) {
  const { id } = await params;
  return <ClientDetail id={id} />;
}

export default function ClientDetailPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <ClientDetailLoader params={params} />
    </Suspense>
  );
}
