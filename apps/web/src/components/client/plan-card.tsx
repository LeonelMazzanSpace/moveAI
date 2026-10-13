'use client';

import { useQuery } from '@tanstack/react-query';
import { CtaLink } from '@/components/public/hero';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { StatusBadge, type StatusTone } from '@/components/move/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { MySubscriptionsDto, SubscriptionDto, SubscriptionStatus } from '@/lib/api/types';
import { formatDate } from '@/lib/format';

const RENEW_HREF = '/planes?service=performance';

const STATUS_BADGE: Record<SubscriptionStatus, { label: string; tone: StatusTone }> = {
  active: { label: 'Activo', tone: 'success' },
  expiring: { label: 'Por vencer', tone: 'warning' },
  expired: { label: 'Vencido', tone: 'danger' },
  scheduled: { label: 'Programado', tone: 'neutral' },
};

export function useMySubscriptions() {
  return useQuery({
    queryKey: ['me', 'subscriptions'],
    queryFn: () => apiFetch<MySubscriptionsDto>('/me/subscriptions'),
  });
}

function daysLeftLabel(daysLeft: number): string {
  return daysLeft === 1 ? '1 día restante' : `${daysLeft} días restantes`;
}

interface ClientPlanCardProps {
  subscription: SubscriptionDto | null;
  upcoming: SubscriptionDto | null;
}

export function ClientPlanCard({ subscription, upcoming }: ClientPlanCardProps) {
  const main = subscription ?? upcoming;
  if (!main) {
    return (
      <EmptyState
        title="Todavía no tenés un plan Performance"
        description="Elegí un plan para reservar tus entrenamientos."
        action={<CtaLink href={RENEW_HREF}>Ver planes</CtaLink>}
      />
    );
  }

  const badge = STATUS_BADGE[main.status];
  const next = subscription && upcoming ? upcoming : null;

  return (
    <div className="rounded border border-border bg-card p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-extrabold uppercase">{`${main.planName} — Performance`}</h2>
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Vigente desde el {formatDate(main.startsOn)} · vence el{' '}
            <span className="font-semibold text-foreground">{formatDate(main.endsOn)}</span>
          </p>
          {next ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {`Próximo plan: ${next.planName}, desde el ${formatDate(next.startsOn)}`}
            </p>
          ) : null}
        </div>
        <CtaLink href={RENEW_HREF}>Renovar plan</CtaLink>
      </div>
      <div className="mt-6">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Progreso del período</span>
          <span>{daysLeftLabel(main.daysLeft)}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Progreso del período"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={main.progressPct}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-soft"
        >
          <div className="h-full rounded-full bg-foreground" style={{ width: `${main.progressPct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function ClientPlanSection() {
  const { data, isPending, isError, error, refetch } = useMySubscriptions();
  if (isPending) return <Skeleton className="h-44 w-full" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return <ClientPlanCard subscription={data.performance} upcoming={data.upcomingPerformance} />;
}
