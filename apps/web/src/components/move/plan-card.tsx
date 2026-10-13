import Link from 'next/link';
import { moveButton } from '@/components/move/button-styles';
import type { PlanDto } from '@/lib/api/types';
import { formatUYU } from '@/lib/format';
import { cn } from '@/lib/utils';

const HIDDEN_TEXT = /prioridad de horarios/i;

interface PlanCardProps {
  plan: PlanDto;
  ctaHref: string;
  ctaLabel: string;
  unitLabel?: string;
}

function periodUnit(plan: PlanDto): string {
  if (plan.periodMonths === 1) return '/mes';
  if (plan.periodMonths === 3) return '/trim';
  if (plan.periodMonths === 6) return '/sem';
  if (plan.periodMonths === 12) return '/año';
  if (plan.periodMonths) return `/${plan.periodMonths} meses`;
  if (plan.periodDays) return `/${plan.periodDays} días`;
  return '';
}

function defaultUnit(plan: PlanDto): string {
  if (plan.kind === 'period_plan') return periodUnit(plan);
  return plan.kind === 'session_pack' ? '/paquete' : '/sesión';
}

function featuredTag(plan: PlanDto): string {
  return plan.kind === 'period_plan' ? 'Más elegido' : 'Recomendado';
}

export function PlanCard({ plan, ctaHref, ctaLabel, unitLabel }: PlanCardProps) {
  const unit = unitLabel ?? defaultUnit(plan);
  const features = plan.features.filter((feature) => !HIDDEN_TEXT.test(feature));

  return (
    <div className={cn('relative rounded border bg-card p-7', plan.featured ? 'border-foreground' : 'border-border')}>
      {plan.featured ? (
        <span className="absolute -top-3 left-6 rounded bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground">
          {featuredTag(plan)}
        </span>
      ) : null}
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{plan.name}</p>
      <p className="mt-3 font-display text-4xl font-black">
        <span>{formatUYU(plan.price)}</span>
        {unit ? <span className="text-sm font-semibold text-muted-foreground"> {unit}</span> : null}
      </p>
      {features.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      ) : null}
      <Link
        href={ctaHref}
        className={moveButton({ variant: plan.featured ? 'default' : 'outline', className: 'mt-6 flex w-full' })}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
