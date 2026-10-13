import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DisplayTitle } from '@/components/move/display-title';
import { PageContainer } from '@/components/move/page-container';
import { Hero } from '@/components/public/hero';
import { HowItWorks } from '@/components/public/how-it-works';
import { loadPlans } from '@/components/public/load-plans';
import { PlansSkeleton } from '@/components/public/plans-section';
import { RecoveryModalities } from '@/components/public/recovery-modalities';

export const metadata: Metadata = {
  title: 'Recovery',
  description:
    'Recovery Room by MOVE: sesiones individuales y paquetes mensuales para clientes y público general. Reservá y pagá online.',
};

const TAGS = ['Abierto a público general', 'Sin plan previo'];

async function RecoveryPlans() {
  const plans = await loadPlans('recovery');
  return <RecoveryModalities plans={plans} />;
}

export default function RecoveryPage() {
  return (
    <>
      <Hero
        eyebrow="03 — Recovery Room by MOVE"
        title={
          <>
            Recuperá
            <br />
            más rápido.
          </>
        }
        description="Recovery está disponible tanto para clientes de MOVE como para público general. Elegí una sesión individual o un paquete mensual, reservá y pagá online."
      >
        <ul className="mt-7 flex items-center gap-2">
          {TAGS.map((tag) => (
            <li
              key={tag}
              className="rounded border border-border bg-card px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              {tag}
            </li>
          ))}
        </ul>
      </Hero>

      <section className="border-t border-border bg-soft">
        <PageContainer className="py-16">
          <DisplayTitle size="lg">Modalidades y planes.</DisplayTitle>
          <div className="mt-10">
            <Suspense fallback={<PlansSkeleton />}>
              <RecoveryPlans />
            </Suspense>
          </div>
        </PageContainer>
      </section>

      <section id="reservar" className="border-t border-border" />

      <HowItWorks />
    </>
  );
}
