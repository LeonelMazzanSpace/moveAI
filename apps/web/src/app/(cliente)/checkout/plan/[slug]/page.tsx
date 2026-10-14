import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PlanCheckout } from '@/components/checkout/plan-checkout';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';

export const metadata: Metadata = { title: 'Contratar plan', robots: { index: false } };

type Params = Promise<{ slug: string }>;

async function PlanCheckoutForSlug({ params }: { params: Params }) {
  const { slug } = await params;
  return <PlanCheckout slug={slug} />;
}

export default function PlanCheckoutPage({ params }: { params: Params }) {
  return (
    <PageContainer className="max-w-xl py-16">
      <Eyebrow>Checkout</Eyebrow>
      <div className="mt-5">
        <DisplayTitle as="h1" size="xl">
          Confirmá tu plan.
        </DisplayTitle>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Revisá el detalle y pagá de forma segura con Mercado Pago.</p>
      <div className="mt-10">
        <Suspense fallback={null}>
          <PlanCheckoutForSlug params={params} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
