import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { DisplayTitle } from '@/components/move/display-title';
import { PageContainer } from '@/components/move/page-container';
import { Hero } from '@/components/public/hero';
import { loadPlans } from '@/components/public/load-plans';
import { PlansSection, PlansSkeleton, PlansUnavailable } from '@/components/public/plans-section';
import { RecoveryModalities } from '@/components/public/recovery-modalities';
import type { Service } from '@/lib/api/types';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Planes',
  description: 'Planes Performance y sesiones y paquetes de Recovery. Elegí el tuyo y contratá online.',
};

type PlanFilter = Extract<Service, 'performance' | 'recovery'> | undefined;

const FILTERS: { label: string; value: PlanFilter }[] = [
  { label: 'Todos', value: undefined },
  { label: 'Performance', value: 'performance' },
  { label: 'Recovery', value: 'recovery' },
];

function parseFilter(value: string | string[] | undefined): PlanFilter {
  return value === 'performance' || value === 'recovery' ? value : undefined;
}

type SearchParams = Promise<{ service?: string | string[] }>;

async function PlanFilters({ searchParams }: { searchParams: SearchParams }) {
  const active = parseFilter((await searchParams).service);
  return (
    <nav aria-label="Filtrar planes" className="mt-8 flex flex-wrap gap-2">
      {FILTERS.map((filter) => (
        <Link
          key={filter.label}
          href={filter.value ? `/planes?service=${filter.value}` : '/planes'}
          aria-current={filter.value === active ? 'page' : undefined}
          className={cn(
            'rounded px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]',
            filter.value === active ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground hover:bg-card',
          )}
        >
          {filter.label}
        </Link>
      ))}
    </nav>
  );
}

async function PlansCatalog({ searchParams }: { searchParams: SearchParams }) {
  const filter = parseFilter((await searchParams).service);
  const [performance, recovery] = await Promise.all([
    filter === 'recovery' ? [] : loadPlans('performance'),
    filter === 'performance' ? [] : loadPlans('recovery'),
  ]);

  if (performance.length === 0 && recovery.length === 0) return <PlansUnavailable />;

  return (
    <div className="space-y-16">
      {performance.length > 0 ? (
        <div>
          <DisplayTitle size="lg">Performance.</DisplayTitle>
          <div className="mt-8">
            <PlansSection plans={performance} ctaLabel="Contratar" hrefFor={(plan) => `/checkout/plan/${plan.slug}`} />
          </div>
        </div>
      ) : null}
      {recovery.length > 0 ? (
        <div>
          <DisplayTitle size="lg">Recovery.</DisplayTitle>
          <div className="mt-8">
            <RecoveryModalities plans={recovery} />
          </div>
        </div>
      ) : null}
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
          <Suspense fallback={null}>
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
