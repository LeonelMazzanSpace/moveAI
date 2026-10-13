'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/move/error-state';
import { StaffPageHeader } from '@/components/move/staff-page-header';
import { StatusBadge, type StatusTone } from '@/components/move/status-badge';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type {
  ActivityItemDto,
  ActivityType,
  BookingDto,
  ClientDetailDto,
  InactivityReasonDto,
  PackDto,
  SubscriptionDto,
  SubscriptionStatus,
} from '@/lib/api/types';
import { formatDate, formatDateLong, formatTime, formatUYU, initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { INACTIVITY_REASON_LABEL } from '../shared/inactivity-reasons';
import { ClientStatusBadge } from './client-status-badge';
import { ContactsList } from './contacts-list';
import { PausePanel, useRefreshClients } from './pause-panel';

const EMPTY = '—';

interface SectionProps {
  title: string;
  children: ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="rounded border border-border bg-card">
      <h3 className="border-b border-border px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">{title}</h3>
      <div className="p-6">{children}</div>
    </section>
  );
}

const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; tone: StatusTone }> = {
  active: { label: 'Vigente', tone: 'success' },
  expiring: { label: 'Por vencer', tone: 'warning' },
  expired: { label: 'Vencido', tone: 'danger' },
  scheduled: { label: 'Programado', tone: 'neutral' },
};

function SubscriptionSummary({ subscription }: { subscription: SubscriptionDto }) {
  const status = SUBSCRIPTION_STATUS[subscription.status];
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{subscription.planName}</p>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{`Vence el ${formatDate(subscription.endsOn)}`}</p>
      <div
        role="progressbar"
        aria-label="Avance del plan"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={subscription.progressPct}
        className="mt-3 h-1.5 overflow-hidden rounded bg-soft"
      >
        <div className="h-full bg-primary" style={{ width: `${subscription.progressPct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{`Quedan ${subscription.daysLeft} días`}</p>
    </div>
  );
}

function PackSummary({ pack }: { pack: PackDto }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <div>
        <p>{pack.planName}</p>
        <p className="text-xs text-muted-foreground">{`Vence el ${formatDate(pack.endsOn)}`}</p>
      </div>
      <span className="text-xs text-muted-foreground">{`${pack.sessionsLeft} de ${pack.sessionsTotal} sesiones`}</span>
    </li>
  );
}

function PlanSection({ detail }: { detail: ClientDetailDto }) {
  const { subscription, upcomingSubscription, recoveryPacks } = detail;
  return (
    <Section title="Plan y paquetes">
      <div className="space-y-5">
        {subscription ? (
          <SubscriptionSummary subscription={subscription} />
        ) : (
          <p className="text-sm text-muted-foreground">Sin plan Performance vigente.</p>
        )}
        {upcomingSubscription ? (
          <p className="text-xs text-muted-foreground">{`Próximo plan: ${upcomingSubscription.planName}, desde el ${formatDate(upcomingSubscription.startsOn)}`}</p>
        ) : null}
        {recoveryPacks.length > 0 ? <ul className="space-y-3 border-t border-border pt-4">{recoveryPacks.map((pack) => <PackSummary key={pack.id} pack={pack} />)}</ul> : null}
      </div>
    </Section>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="rounded border border-border bg-soft p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-black">{children}</p>
    </div>
  );
}

function MetricsSection({ metrics }: { metrics: ClientDetailDto['metrics'] }) {
  return (
    <Section title="Métricas">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Frecuencia">{metrics.frequencyPerWeek > 0 ? `${metrics.frequencyPerWeek.toFixed(1)} /sem` : EMPTY}</Metric>
        <Metric label="Asistencias este mes">{metrics.attendancesThisMonth}</Metric>
        <Metric label="Última asistencia">{metrics.lastAttendanceOn ? formatDate(metrics.lastAttendanceOn) : EMPTY}</Metric>
        <Metric label="Cancelaciones">{metrics.cancellations}</Metric>
        <Metric label="No show">{metrics.noShows}</Metric>
        <Metric label="Rehab / Recovery">{`${metrics.rehabCount} / ${metrics.recoveryCount}`}</Metric>
      </div>
    </Section>
  );
}

function ReasonsList({ reasons }: { reasons: InactivityReasonDto[] }) {
  if (reasons.length === 0) return <p className="text-sm text-muted-foreground">Sin motivos registrados.</p>;
  return (
    <ul className="divide-y divide-border">
      {reasons.map((reason) => (
        <li key={reason.id} className="py-3 first:pt-0 last:pb-0">
          <p className="text-sm font-medium">{INACTIVITY_REASON_LABEL[reason.reason]}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {`${formatDate(reason.startedAt)} → ${reason.endedAt ? formatDate(reason.endedAt) : 'en curso'} · ${reason.createdByName}`}
          </p>
          {reason.note ? <p className="mt-1 text-sm text-muted-foreground">{reason.note}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function UpcomingBookings({ bookings }: { bookings: BookingDto[] }) {
  if (bookings.length === 0) return <p className="text-sm text-muted-foreground">No tiene reservas próximas.</p>;
  return (
    <ul className="divide-y divide-border">
      {bookings.map((booking) => (
        <li key={booking.id} className="py-3 first:pt-0 last:pb-0">
          <p className="text-sm font-medium">{booking.label}</p>
          <p className="text-xs text-muted-foreground">{`${formatDateLong(booking.startsAt)} · ${formatTime(booking.startsAt)}`}</p>
        </li>
      ))}
    </ul>
  );
}

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  attendance: 'Asistencia',
  booking: 'Reserva',
  cancellation: 'Cancelación',
  payment: 'Pago',
};

function HistoryList({ history }: { history: ActivityItemDto[] }) {
  if (history.length === 0) return <p className="text-sm text-muted-foreground">Todavía no hay actividad.</p>;
  return (
    <ul className="divide-y divide-border">
      {history.map((item, index) => (
        <li key={`${item.type}-${item.date}-${index}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div>
            <p className="text-sm">{item.label}</p>
            <p className="text-xs text-muted-foreground">{`${ACTIVITY_LABEL[item.type]} · ${formatDate(item.date)}`}</p>
          </div>
          {item.amount !== null ? <span className="text-sm text-muted-foreground">{formatUYU(item.amount)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function RehabToggle({ client }: { client: ClientDetailDto['client'] }) {
  const labelId = useId();
  const refresh = useRefreshClients();
  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch<ClientDetailDto['client']>(`/staff/clients/${client.id}/rehab-followup`, { method: 'PATCH', body: { enabled } }),
    onSuccess: async (_data, enabled) => {
      await refresh();
      toast.success(enabled ? 'Seguimiento fisioterapéutico habilitado' : 'Seguimiento fisioterapéutico deshabilitado');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={client.rehabFollowupEnabled}
        aria-labelledby={labelId}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(!client.rehabFollowupEnabled)}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full border border-border transition-colors disabled:opacity-50',
          client.rehabFollowupEnabled ? 'bg-success' : 'bg-soft',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3.5 rounded-full bg-foreground transition-all',
            client.rehabFollowupEnabled ? 'left-[1.125rem]' : 'left-0.5',
          )}
        />
      </button>
      <span id={labelId} className="text-sm">
        Seguimiento fisioterapéutico habilitado
      </span>
    </div>
  );
}

function ClientHeader({ client }: { client: ClientDetailDto['client'] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-6 rounded border border-border bg-card p-6">
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-soft text-sm font-semibold">{initials(client.name)}</div>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-black uppercase tracking-tight">{client.name}</h2>
            <ClientStatusBadge status={client.status} pauseReason={client.pauseReason} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{client.email}</p>
          <p className="text-sm text-muted-foreground">{client.phone ?? EMPTY}</p>
        </div>
      </div>
      <RehabToggle client={client} />
    </div>
  );
}

function DetailContent({ detail }: { detail: ClientDetailDto }) {
  return (
    <div className="space-y-6">
      <ClientHeader client={detail.client} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PlanSection detail={detail} />
          <MetricsSection metrics={detail.metrics} />
          <Section title="Próximas reservas">
            <UpcomingBookings bookings={detail.upcomingBookings} />
          </Section>
          <Section title="Historial">
            <HistoryList history={detail.history} />
          </Section>
        </div>
        <div className="space-y-6">
          <Section title={detail.activePause ? 'Pausa activa' : 'Registrar motivo'}>
            <PausePanel clientId={detail.client.id} activePause={detail.activePause} />
          </Section>
          <Section title="Contactos">
            <ContactsList contacts={detail.contacts} />
          </Section>
          <Section title="Motivos">
            <ReasonsList reasons={detail.reasons} />
          </Section>
        </div>
      </div>
    </div>
  );
}

export function ClientDetail({ id }: { id: string }) {
  const detail = useQuery({
    queryKey: ['staff', 'clients', 'detail', id],
    queryFn: () => apiFetch<ClientDetailDto>(`/staff/clients/${id}`),
  });

  return (
    <>
      <StaffPageHeader
        title="Cliente"
        actions={
          <Link href="/staff/clientes" className={buttonVariants({ variant: 'outline' })}>
            ← Clientes
          </Link>
        }
      />
      {detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      ) : detail.isPending ? (
        <Skeleton className="h-96" />
      ) : (
        <DetailContent detail={detail.data} />
      )}
    </>
  );
}

