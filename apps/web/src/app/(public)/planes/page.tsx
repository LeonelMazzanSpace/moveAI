import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { moveButton } from '@/components/move/button-styles';
import { PageContainer } from '@/components/move/page-container';
import { Hero } from '@/components/public/hero';
import { loadPlans } from '@/components/public/load-plans';
import { FILTERS, parseFilter, servicesFor } from '@/components/public/plan-filter';
import { PlansCatalog } from '@/components/public/plans-catalog';
import { PlansSkeleton } from '@/components/public/plans-section';

export const metadata: Metadata = {
  title: 'Planes',
  description: 'Planes Performance y sesiones y paquetes de Recovery. Elegí el tuyo y contratá online.',
};

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
          className={moveButton({ variant: filter.value === active ? 'default' : 'outline' })}
        >
          {filter.label}
        </Link>
      ))}
    </nav>
  );
}

async function LoadedCatalog({ searchParams }: { searchParams: SearchParams }) {
  const services = servicesFor(parseFilter((await searchParams).service));
  const sections = await Promise.all(services.map(async (service) => ({ service, plans: await loadPlans(service) })));
  return <PlansCatalog sections={sections} />;
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
              <LoadedCatalog searchParams={searchParams} />
            </Suspense>
          </div>
        </PageContainer>
      </section>
    </>
  );
}
