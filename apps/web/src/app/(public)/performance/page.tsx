import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PerformanceSchedule } from '@/components/booking/performance-schedule';
import { DisplayTitle } from '@/components/move/display-title';
import { PageContainer } from '@/components/move/page-container';
import { CtaLink, Hero } from '@/components/public/hero';
import { loadPlans } from '@/components/public/load-plans';
import { PlansSection, PlansSkeleton } from '@/components/public/plans-section';

export const metadata: Metadata = {
  title: 'Performance',
  description:
    'Entrenamiento semi personalizado con reserva previa, sin límite semanal de asistencias y con capacidad máxima por horario.',
};

const HIGHLIGHTS = ['Reserva previa obligatoria', 'Sin límite semanal', 'Capacidad máxima por horario'];

async function PerformancePlans() {
  const plans = await loadPlans('performance');
  return <PlansSection plans={plans} ctaLabel="Contratar" hrefFor={(plan) => `/checkout/plan/${plan.slug}`} />;
}

export default function PerformancePage() {
  return (
    <>
      <Hero
        eyebrow="01 — Performance"
        title={
          <>
            Entrenamiento
            <br />
            semi personalizado.
          </>
        }
        description="Todos los planes incluyen acceso mediante reserva previa, sin límite semanal de asistencias. Cada horario tiene una capacidad máxima y solo puede reservarse con un plan vigente."
      >
        <ul className="mt-8 flex flex-wrap gap-6 text-xs text-muted-foreground">
          {HIGHLIGHTS.map((highlight) => (
            <li key={highlight} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
              {highlight}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <CtaLink href="/performance#horarios" variant="outline">
            Ver horarios
          </CtaLink>
        </div>
      </Hero>

      <section className="border-t border-border bg-soft">
        <PageContainer className="py-16">
          <DisplayTitle size="lg">Planes disponibles.</DisplayTitle>
          <p className="mt-3 text-sm text-muted-foreground">
            Seleccioná un plan y avanzá hacia la contratación. El pago se procesa online.
          </p>
          <div className="mt-10">
            <Suspense fallback={<PlansSkeleton />}>
              <PerformancePlans />
            </Suspense>
          </div>
        </PageContainer>
      </section>

      <section id="horarios" className="border-t border-border">
        <PageContainer className="pb-2 pt-16">
          <PerformanceSchedule />
        </PageContainer>
      </section>

      <section>
        <PageContainer className="pb-16 pt-6">
          <div className="rounded border border-border bg-soft px-5 py-4 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Plan vigente:</span> para reservar necesitás un plan activo en la
            fecha del turno. Si tu plan vence, renovalo desde tu perfil para seguir reservando.
          </div>
        </PageContainer>
      </section>
    </>
  );
}
