import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SimulatorPanel } from '@/components/checkout/simulator-panel';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Simulador de pagos', robots: { index: false } };

export default function PaymentSimulatorPage() {
  return (
    <PageContainer className="max-w-xl py-16">
      <Eyebrow>Desarrollo</Eyebrow>
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-48 rounded" />}>
          <SimulatorPanel />
        </Suspense>
      </div>
    </PageContainer>
  );
}
