'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type { MySubscriptionsDto, PlanDto } from '@/lib/api/types';
import { addDaysWeb, formatDate, formatUYU } from '@/lib/format';
import { usePlanCheckout } from './use-checkout';

const HIDDEN_TEXT = /prioridad de horarios/i;

function validity(plan: PlanDto): string | null {
  if (plan.periodMonths) return plan.periodMonths === 1 ? '1 mes' : `${plan.periodMonths} meses`;
  if (plan.periodDays) return `${plan.periodDays} días`;
  return null;
}

function summaryRows(plan: PlanDto): [string, string][] {
  const rows: [string, string][] = [];
  if (plan.sessionsIncluded) rows.push(['Sesiones', String(plan.sessionsIncluded)]);
  const period = validity(plan);
  if (period) rows.push([plan.kind === 'session_pack' ? 'Vigencia del paquete' : 'Período', period]);
  return rows;
}

/** Inicio del nuevo período si ya tiene un plan Performance vigente o programado. */
function renewalStart(plan: PlanDto, subscriptions: MySubscriptionsDto | undefined): string | null {
  if (plan.kind !== 'period_plan') return null;
  const current = subscriptions?.upcomingPerformance ?? subscriptions?.performance;
  if (!current || current.status === 'expired') return null;
  return addDaysWeb(current.endsOn, 1);
}

function PlanSummary({ plan, startsOn }: { plan: PlanDto; startsOn: string | null }) {
  const features = plan.features.filter((feature) => !HIDDEN_TEXT.test(feature));

  return (
    <div className="rounded border border-border bg-card p-7">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{plan.name}</p>
      <p className="mt-3 font-display text-4xl font-black">{formatUYU(plan.price)}</p>
      <dl className="mt-5 space-y-3 text-sm">
        {summaryRows(plan).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {plan.kind === 'session_pack' ? (
        <p className="mt-4 text-sm text-muted-foreground">Las sesiones no usadas vencen al final del período.</p>
      ) : null}
      {features.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      ) : null}
      {startsOn ? (
        <p className="mt-5 border-t border-border pt-5 text-sm font-medium">Tu nuevo período empieza el {formatDate(startsOn)}</p>
      ) : null}
    </div>
  );
}

function PlanUnavailable() {
  return (
    <EmptyState
      title="Plan no disponible"
      description="Este plan no existe o no se puede contratar online."
      action={
        <Link href="/planes" className="text-xs font-semibold underline underline-offset-4">
          Ver planes
        </Link>
      }
    />
  );
}

export function PlanCheckout({ slug }: { slug: string }) {
  const plan = useQuery({
    queryKey: ['catalog', 'plan', slug],
    queryFn: () => apiFetch<PlanDto>(`/catalog/plans/${encodeURIComponent(slug)}`),
    retry: false,
  });
  const subscriptions = useQuery({
    queryKey: ['me', 'subscriptions'],
    queryFn: () => apiFetch<MySubscriptionsDto>('/me/subscriptions'),
  });
  const checkout = usePlanCheckout();

  if (plan.isPending) return <Skeleton className="h-64 rounded" />;
  if (plan.error instanceof ApiError && plan.error.code === 'PLAN_NOT_FOUND') return <PlanUnavailable />;
  if (plan.isError) return <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />;
  if (plan.data.kind !== 'period_plan' && plan.data.kind !== 'session_pack') return <PlanUnavailable />;

  return (
    <div className="space-y-6">
      <PlanSummary plan={plan.data} startsOn={renewalStart(plan.data, subscriptions.data)} />
      {checkout.isError ? (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(checkout.error)}
        </p>
      ) : null}
      <Button
        disabled={checkout.isPending || checkout.isSuccess}
        onClick={() => checkout.mutate(plan.data.id)}
        className="h-auto w-full py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
      >
        Pagar con Mercado Pago
      </Button>
    </div>
  );
}
