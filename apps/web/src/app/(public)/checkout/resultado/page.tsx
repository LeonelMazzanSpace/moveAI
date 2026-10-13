import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaymentResult } from '@/components/checkout/payment-result';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Resultado del pago', robots: { index: false } };

export default function PaymentResultPage() {
  return (
    <PageContainer className="max-w-xl py-16">
      <Eyebrow>Checkout</Eyebrow>
      <div className="mt-5">
        <DisplayTitle as="h1" size="xl">
          Tu pago.
        </DisplayTitle>
      </div>
      <div className="mt-10">
        <Suspense fallback={<Skeleton className="h-48 rounded" />}>
          <PaymentResult />
        </Suspense>
      </div>
    </PageContainer>
  );
}
