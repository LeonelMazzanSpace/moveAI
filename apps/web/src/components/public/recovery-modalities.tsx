import { PlanCard } from '@/components/move/plan-card';
import type { PlanDto } from '@/lib/api/types';
import { PlansUnavailable } from './plans-section';

interface RecoveryModalitiesProps {
  plans: PlanDto[];
}

function isModality(plan: PlanDto): boolean {
  return plan.kind === 'single_session' || plan.kind === 'session_pack';
}

export function RecoveryModalities({ plans }: RecoveryModalitiesProps) {
  const modalities = plans.filter(isModality);
  if (modalities.length === 0) return <PlansUnavailable />;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {modalities.map((plan) =>
        plan.kind === 'single_session' ? (
          <PlanCard key={plan.id} plan={plan} ctaHref="/recovery#reservar" ctaLabel="Reservar sesión" unitLabel="/sesión" />
        ) : (
          <PlanCard
            key={plan.id}
            plan={plan}
            ctaHref={`/checkout/plan/${plan.slug}`}
            ctaLabel="Contratar paquete"
            unitLabel="/paquete"
          />
        ),
      )}
    </div>
  );
}
