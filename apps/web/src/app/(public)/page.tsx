import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { PageContainer } from '@/components/move/page-container';
import { AccountCta } from '@/components/public/account-cta';
import { CtaLink, Hero } from '@/components/public/hero';
import { loadPlans } from '@/components/public/load-plans';
import { PlansSection, PlansSkeleton } from '@/components/public/plans-section';
import { ServiceCards } from '@/components/public/service-cards';
import { TeamSection } from '@/components/public/team-section';

export const metadata: Metadata = {
  title: { absolute: 'MOVE — Performance, Rehab & Recovery' },
  description:
    'Entrenamiento y recuperación basados en evidencia. Conocé nuestros servicios, contratá tu plan y reservá online.',
};

async function FeaturedPlans() {
  const plans = await loadPlans('performance');
  return <PlansSection plans={plans} ctaLabel="Contratar" hrefFor={(plan) => `/checkout/plan/${plan.slug}`} />;
}

export default function HomePage() {
  return (
    <>
      <Hero
        size="hero"
        eyebrow="Performance & Rehab · Uruguay"
        title={
          <>
            Movete mejor.
            <br />
            Recuperá
            <br />
            más rápido.
          </>
        }
        description="Entrenamiento y recuperación basados en evidencia. Conocé nuestros servicios, contratá tu plan y reservá online — todo desde una misma plataforma."
      >
        <div className="mt-9 flex flex-wrap gap-3">
          <CtaLink href="/planes">Ver planes</CtaLink>
          <CtaLink href="/recovery#reservar" variant="outline">
            Reservar Recovery
          </CtaLink>
        </div>
      </Hero>

      <section className="border-t border-border bg-soft">
        <PageContainer className="py-20">
          <Eyebrow index="01">Servicios</Eyebrow>
          <div className="mt-4">
            <DisplayTitle>Tres áreas. Una experiencia.</DisplayTitle>
          </div>
          <ServiceCards />
        </PageContainer>
      </section>

      <TeamSection />

      <section className="border-t border-border">
        <PageContainer className="py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Eyebrow index="03">Planes</Eyebrow>
              <div className="mt-4">
                <DisplayTitle>Elegí tu plan.</DisplayTitle>
              </div>
            </div>
            <CtaLink href="/planes" variant="outline">
              Ver todos los planes
            </CtaLink>
          </div>
          <div className="mt-12">
            <Suspense fallback={<PlansSkeleton />}>
              <FeaturedPlans />
            </Suspense>
          </div>
        </PageContainer>
      </section>

      <AccountCta />
    </>
  );
}
