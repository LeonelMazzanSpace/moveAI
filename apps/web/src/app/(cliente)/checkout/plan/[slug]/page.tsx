import type { Metadata } from 'next';
import { PlanCheckout } from '@/components/checkout/plan-checkout';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';

export const metadata: Metadata = { title: 'Contratar plan', robots: { index: false } };

export default async function PlanCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

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
        <PlanCheckout slug={slug} />
      </div>
    </PageContainer>
  );
}
