import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { DisplayTitle } from '@/components/move/display-title';
import { PageContainer } from '@/components/move/page-container';
import { Hero } from '@/components/public/hero';
import { loadPlans } from '@/components/public/load-plans';
import { FILTERS, type CatalogService, parseFilter, servicesFor } from '@/components/public/plan-filter';
import { PlansSection, PlansSkeleton, PlansUnavailable } from '@/components/public/plans-section';
import { RecoveryModalities } from '@/components/public/recovery-modalities';
import type { PlanDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Planes',
  description: 'Planes Performance y sesiones y paquetes de Recovery. Elegí el tuyo y contratá online.',
};

const SECTION_TITLE: Record<CatalogService, string> = { performance: 'Performance.', recovery: 'Recovery.' };

type SearchParams = Promise<{ service?: string | string[] }>;

async function PlanFilters({ searchParams }: { searchParams: SearchParams }) {
  const active = parseFilter((await searchParams).service);
  return (
    <nav aria-label="Filtrar planes" className="mt-8 flex min-h-8 flex-wrap gap-2">
      {FILTERS.map((filter) => (
        <Link
          key={filter.label}
          href={filter.value ? `/planes?service=${filter.value}` : '/planes'}
          aria-current={filter.value === active ? 'page' : undefined}
          className={cn(
            'flex h-8 items-center rounded px-3.5 text-[10px] font-semibold uppercase tracking-[0.2em]',
            filter.value === active ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground hover:bg-card',
          )}
        >
          {filter.label}
        </Link>
      ))}
    </nav>
  );
}

function CatalogSection({ service, plans }: { service: CatalogService; plans: PlanDto[] }) {
  return (
    <div>
      <DisplayTitle size="lg">{SECTION_TITLE[service]}</DisplayTitle>
      <div className="mt-8">
        {service === 'performance' ? (
          <PlansSection plans={plans} ctaLabel="Contratar" hrefFor={(plan) => `/checkout/plan/${plan.slug}`} />
        ) : (
          <RecoveryModalities plans={plans} />
        )}
      </div>
    </div>
  );
}

async function PlansCatalog({ searchParams }: { searchParams: SearchParams }) {
  const services = servicesFor(parseFilter((await searchParams).service));
  const sections = await Promise.all(services.map(async (service) => ({ service, plans: await loadPlans(service) })));

  if (sections.every(({ plans }) => plans.length === 0)) return <PlansUnavailable />;

  return (
    <div className="space-y-16">
      {sections.map(({ service, plans }) => (
        <CatalogSection key={service} service={service} plans={plans} />
      ))}
    </div>
  );
}

export default function PlanesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <Hero
        eyebrow="Planes"
        title="Elegí tu plan."
        description="Planes de entrenamiento Performance y sesiones o paquetes de Recovery. El pago se procesa online."
      />
      <section className="border-t border-border bg-soft">
        <PageContainer className="pb-16 pt-2">
          <Suspense fallback={<div aria-hidden className="mt-8 h-8" />}>
            <PlanFilters searchParams={searchParams} />
          </Suspense>
          <div className="mt-10">
            <Suspense fallback={<PlansSkeleton />}>
              <PlansCatalog searchParams={searchParams} />
            </Suspense>
          </div>
        </PageContainer>
      </section>
    </>
  );
}
