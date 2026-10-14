'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CtaLink } from '@/components/public/hero';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { StatusBadge, type StatusTone } from '@/components/move/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { MySubscriptionsDto, SubscriptionDto, SubscriptionStatus } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { AutoDebitCard } from './auto-debit-card';

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
  /** Bloque al pie de la tarjeta (el débito automático); se oculta solo si no renderiza nada. */
  footer?: ReactNode;
}

export function ClientPlanCard({ subscription, upcoming, footer }: ClientPlanCardProps) {
  const main = subscription ?? upcoming;
  if (!main) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Todavía no tenés un plan Performance"
          description="Elegí un plan para reservar tus entrenamientos."
          action={<CtaLink href={RENEW_HREF}>Ver planes</CtaLink>}
        />
        <div className="empty:hidden">{footer}</div>
      </div>
    );
  }

  const badge = STATUS_BADGE[main.status];
  const next = subscription && upcoming ? upcoming : null;
  const scheduled = main.status === 'scheduled';

  return (
    <div className="rounded border border-border bg-card p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-extrabold uppercase">{`${main.planName} — Performance`}</h2>
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {scheduled ? 'Comienza' : 'Vigente desde'} el {formatDate(main.startsOn)} · vence el{' '}
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
      {scheduled ? null : (
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
      )}
      <div className="mt-6 empty:hidden">{footer}</div>
    </div>
  );
}

export function ClientPlanSection() {
  const { data, isPending, isError, error, refetch } = useMySubscriptions();
  if (isPending) return <Skeleton className="h-44 w-full" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  const lastPaidDay = (data.upcomingPerformance ?? data.performance)?.endsOn ?? null;
  return (
    <ClientPlanCard
      subscription={data.performance}
      upcoming={data.upcomingPerformance}
      footer={<AutoDebitCard service="performance" endsOn={lastPaidDay} />}
    />
  );
}
