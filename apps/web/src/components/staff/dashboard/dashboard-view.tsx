'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api/client';
import type { AlertCountsDto, AlertType, DashboardDto, StaffTimeSlotDto } from '@/lib/api/types';
import { businessTodayWeb, formatTime, SERVICE_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ClientKpis } from '../clientes/client-kpis';

const ALERT_CARDS: { type: AlertType; label: string }[] = [
  { type: 'expiring', label: 'Por vencer' },
  { type: 'expired', label: 'Vencidos' },
  { type: 'no_attendance', label: 'Sin asistir' },
  { type: 'prolonged_inactivity', label: 'Inactividad prolongada' },
  { type: 'frequency_drop', label: 'Baja de frecuencia' },
  { type: 'recontact', label: 'Re-contacto' },
  { type: 'checkin_pain', label: 'Check-in con dolor' },
  { type: 'checkin_goals', label: 'Check-in con objetivos' },
];

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">{children}</h2>;
}

function PendingAttendanceNotice({ count }: { count: number }) {
  if (count === 0) return null;
  const title = count === 1 ? 'Hay 1 turno con asistencia pendiente' : `Hay ${count} turnos con asistencia pendiente`;
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-warning-muted px-6 py-4">
      <p className="text-sm font-semibold text-warning">{title}</p>
      <Link href="/staff/turnos" className="inline-flex min-h-8 items-center text-xs underline underline-offset-4 hover:text-foreground">
        Ir a turnos y asistencia
      </Link>
    </div>
  );
}

function AlertCards({ counts }: { counts: AlertCountsDto }) {
  return (
    <section>
      <SectionTitle>{`Alertas abiertas · ${counts.total}`}</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ALERT_CARDS.map(({ type, label }) => (
          <Link
            key={type}
            href={`/staff/seguimiento?tipo=${type}`}
            aria-label={`${label} · ${counts[type]}`}
            className="rounded border border-border bg-card p-5 hover:bg-soft"
          >
            <span className="block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
            <span className={cn('mt-2 block font-display text-3xl font-black', counts[type] === 0 && 'text-muted-foreground')}>
              {counts[type]}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function slotHref(slot: StaffTimeSlotDto): string {
  const params = new URLSearchParams({
    fecha: businessTodayWeb(new Date(slot.startsAt)),
    servicio: slot.service,
    turno: slot.id,
  });
  return `/staff/turnos?${params.toString()}`;
}

function TodaySlots({ slots }: { slots: StaffTimeSlotDto[] }) {
  return (
    <section>
      <SectionTitle>Turnos de hoy</SectionTitle>
      {slots.length === 0 ? (
        <EmptyState title="Sin turnos hoy" description="No hay turnos programados para hoy." />
      ) : (
        <div className="overflow-hidden rounded border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:bg-transparent">
                <TableHead className="px-4">Hora</TableHead>
                <TableHead className="px-4">Servicio</TableHead>
                <TableHead className="px-4">Reservas</TableHead>
                <TableHead className="px-4">Presentes</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {slots.map((slot) => (
                <TableRow key={slot.id} className={cn(slot.cancelledAt && 'opacity-50')}>
                  <TableCell className={cn('px-4 py-3.5 font-medium', slot.cancelledAt && 'line-through')}>{formatTime(slot.startsAt)}</TableCell>
                  <TableCell className="px-4 py-3.5">{SERVICE_LABEL[slot.service]}</TableCell>
                  <TableCell className="px-4 py-3.5 text-muted-foreground">{`${slot.booked}/${slot.capacity}`}</TableCell>
                  <TableCell className="px-4 py-3.5 text-muted-foreground">{slot.present}</TableCell>
                  <TableCell className="px-4 py-3.5 text-right">
                    <Link href={slotHref(slot)} className="text-xs underline underline-offset-4 hover:text-foreground">
                      Ver turno
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

export function DashboardView() {
  const dashboard = useQuery({ queryKey: ['staff', 'dashboard'], queryFn: () => apiFetch<DashboardDto>('/staff/dashboard') });

  if (dashboard.isError) return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  if (dashboard.isPending) return <Skeleton className="h-96" />;

  const { kpis, alertCounts, todaySlots, pendingAttendanceSlots } = dashboard.data;
  return (
    <div className="space-y-6">
      <PendingAttendanceNotice count={pendingAttendanceSlots} />
      <ClientKpis kpis={kpis} />
      <AlertCards counts={alertCounts} />
      <TodaySlots slots={todaySlots} />
    </div>
  );
}
