import { EmptyState } from '@/components/move/empty-state';
import { PlanCard } from '@/components/move/plan-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { PlanDto } from '@/lib/api/types';

interface PlansSectionProps {
  plans: PlanDto[];
  ctaLabel: string;
  hrefFor: (plan: PlanDto) => string;
}

export function unitLabelFor(plan: PlanDto): string | undefined {
  return plan.kind === 'session_pack' ? '/mes' : undefined;
}

export function PlansUnavailable() {
  return <EmptyState title="Planes no disponibles por el momento" description="Volvé a intentar en unos minutos." />;
}

export function PlansSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {[0, 1, 2].map((key) => (
        <Skeleton key={key} className="h-64" />
      ))}
    </div>
  );
}

export function PlansSection({ plans, ctaLabel, hrefFor }: PlansSectionProps) {
  if (plans.length === 0) return <PlansUnavailable />;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} ctaHref={hrefFor(plan)} ctaLabel={ctaLabel} unitLabel={unitLabelFor(plan)} />
      ))}
    </div>
  );
}
