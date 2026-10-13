'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useBusinessToday } from '@/components/booking/day-selector';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { moveButton } from '@/components/move/button-styles';
import { StaffPageHeader } from '@/components/move/staff-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { AttendanceStatus, Paginated, RosterItemDto, Service, StaffTimeSlotDto } from '@/lib/api/types';
import { addDaysWeb, businessDateOf, formatDateLong, formatTime, SERVICE_LABEL } from '@/lib/format';
import { ATTENDANCE_HINT } from './attendance-buttons';
import { PendingAttendanceBanner } from './pending-attendance-banner';
import { RosterTable } from './roster-table';
import { CancelBookingDialog, SlotActions } from './slot-actions';
import { SlotChips } from './slot-chips';
import { SlotKpis } from './slot-kpis';

const PATH = '/staff/turnos';
const ROSTER_PAGE_SIZE = 20;
const SERVICES: Service[] = ['performance', 'recovery', 'rehab'];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

interface UrlState {
  fecha: string;
  servicio: Service;
  turno?: string;
}

function parseBusinessDate(value: string | null): string | null {
  if (!value || !DATE_ONLY.test(value)) return null;
  return addDaysWeb(value, 0) === value ? value : null;
}

function parseService(value: string | null): Service {
  return SERVICES.find((service) => service === value) ?? 'performance';
}

function toUrl({ fecha, servicio, turno }: UrlState): string {
  const params = new URLSearchParams({ fecha, servicio });
  if (turno) params.set('turno', turno);
  return `${PATH}?${params.toString()}`;
}

const COUNTER = { present: 'present', absent: 'absent', no_show: 'noShow' } as const;

function shiftCounters(slot: StaffTimeSlotDto, previous: AttendanceStatus | null, next: AttendanceStatus): StaffTimeSlotDto {
  const updated = { ...slot };
  if (previous) updated[COUNTER[previous]] -= 1;
  else updated.pendingAttendance = Math.max(0, updated.pendingAttendance - 1);
  updated[COUNTER[next]] += 1;
  return updated;
}

function useMarkAttendance(slotId: string) {
  const queryClient = useQueryClient();
  const rosterKey: QueryKey = ['staff', 'roster', slotId];
  const slotsKey: QueryKey = ['staff', 'time-slots'];

  return useMutation({
    mutationFn: ({ bookingId, status }: { bookingId: string; status: AttendanceStatus }) =>
      apiFetch<RosterItemDto>(`/staff/bookings/${bookingId}/attendance`, { method: 'PUT', body: { status } }),
    onMutate: async ({ bookingId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['staff'] });
      const snapshots = [
        ...queryClient.getQueriesData<Paginated<RosterItemDto>>({ queryKey: rosterKey }),
        ...queryClient.getQueriesData<StaffTimeSlotDto[]>({ queryKey: slotsKey }),
      ];
      const previous =
        queryClient
          .getQueriesData<Paginated<RosterItemDto>>({ queryKey: rosterKey })
          .flatMap(([, data]) => data?.items ?? [])
          .find((row) => row.bookingId === bookingId)?.attendance ?? null;

      queryClient.setQueriesData<Paginated<RosterItemDto>>({ queryKey: rosterKey }, (data) =>
        data && { ...data, items: data.items.map((row) => (row.bookingId === bookingId ? { ...row, attendance: status } : row)) },
      );
      queryClient.setQueriesData<StaffTimeSlotDto[]>({ queryKey: slotsKey }, (data) =>
        data?.map((slot) => (slot.id === slotId ? shiftCounters(slot, previous, status) : slot)),
      );
      return { snapshots };
    },
    onError: (error, _variables, context) => {
      for (const [key, data] of context?.snapshots ?? []) queryClient.setQueryData(key, data);
      toast.error(errorMessage(error));
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: slotsKey }),
        queryClient.invalidateQueries({ queryKey: ['staff', 'roster'] }),
      ]),
  });
}

interface DateNavigatorProps {
  date: string;
  onChange: (date: string) => void;
}

function DateNavigator({ date, onChange }: DateNavigatorProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Día anterior" onClick={() => onChange(addDaysWeb(date, -1))}>
        <ChevronLeftIcon />
      </Button>
      <span className="hidden min-w-36 text-center text-xs font-medium md:inline">{formatDateLong(date)}</span>
      <Input
        type="date"
        aria-label="Fecha"
        value={date}
        className="w-40"
        onChange={(event) => {
          const next = parseBusinessDate(event.target.value);
          if (next) onChange(next);
        }}
      />
      <Button variant="outline" size="icon" aria-label="Día siguiente" onClick={() => onChange(addDaysWeb(date, 1))}>
        <ChevronRightIcon />
      </Button>
    </div>
  );
}

function ServiceTabs({ value, onChange }: { value: Service; onChange: (service: Service) => void }) {
  return (
    <div role="group" aria-label="Servicio" className="flex flex-wrap gap-1">
      {SERVICES.map((service) => (
        <button
          key={service}
          type="button"
          aria-pressed={service === value}
          onClick={() => onChange(service)}
          className={moveButton({ variant: service === value ? 'default' : 'outline' })}
        >
          {SERVICE_LABEL[service]}
        </button>
      ))}
    </div>
  );
}

interface RosterContentProps {
  roster: UseQueryResult<Paginated<RosterItemDto>>;
  page: number;
  canMark: boolean;
  markHint?: string;
  onMark: (bookingId: string, status: AttendanceStatus) => void;
  onCancel: (bookingId: string) => void;
  onPageChange: (page: number) => void;
}

function RosterContent({ roster, page, canMark, markHint, onMark, onCancel, onPageChange }: RosterContentProps) {
  if (roster.isError) {
    return (
      <div className="p-6">
        <ErrorState error={roster.error} onRetry={() => void roster.refetch()} />
      </div>
    );
  }
  if (roster.isPending) return <Skeleton className="m-6 h-40" />;
  if (roster.data.items.length === 0) {
    return (
      <div className="p-6">
        <EmptyState title="Sin reservas" description="Este turno todavía no tiene reservas." />
      </div>
    );
  }
  return (
    <RosterTable
      rows={roster.data.items}
      canMark={canMark}
      markHint={markHint}
      onMark={onMark}
      onCancel={onCancel}
      pagination={{ total: roster.data.total, page, pageSize: ROSTER_PAGE_SIZE, onPageChange }}
    />
  );
}

interface SlotDetailProps {
  slot: StaffTimeSlotDto;
  today: string | null;
}

function SlotDetail({ slot, today }: SlotDetailProps) {
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<RosterItemDto | null>(null);
  const mark = useMarkAttendance(slot.id);
  const roster = useQuery({
    queryKey: ['staff', 'roster', slot.id, page],
    queryFn: () =>
      apiFetch<Paginated<RosterItemDto>>(`/staff/time-slots/${slot.id}/roster`, { query: { page, pageSize: ROSTER_PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  });

  const slotDate = businessDateOf(slot.startsAt);
  const canMark = today !== null && slot.cancelledAt === null && slotDate !== null && slotDate <= today;
  const rows = roster.data?.items ?? [];

  function handleMark(bookingId: string, status: AttendanceStatus) {
    if (rows.find((row) => row.bookingId === bookingId)?.attendance === status) return;
    mark.mutate({ bookingId, status });
  }

  return (
    <>
      <SlotKpis slot={slot} />
      <div className="mt-6 overflow-hidden rounded border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">
            Turno {formatTime(slot.startsAt)} — {SERVICE_LABEL[slot.service]}
            {slot.cancelledAt ? <span className="ml-2 text-xs font-normal text-danger">Turno cancelado</span> : null}
          </h2>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground md:inline">Marcá el resultado de cada alumno</span>
            {slot.cancelledAt ? null : <SlotActions slot={slot} />}
          </div>
        </div>
        <RosterContent
          roster={roster}
          page={page}
          canMark={canMark}
          markHint={slot.cancelledAt === null && today !== null ? ATTENDANCE_HINT : undefined}
          onMark={handleMark}
          onCancel={(bookingId) => setCancelling(rows.find((row) => row.bookingId === bookingId) ?? null)}
          onPageChange={setPage}
        />
      </div>
      <CancelBookingDialog booking={cancelling} onClose={() => setCancelling(null)} />
    </>
  );
}

interface DayViewProps {
  state: UrlState;
  today: string | null;
  onNavigate: (state: UrlState) => void;
}

function DayView({ state, today, onNavigate }: DayViewProps) {
  const slots = useQuery({
    queryKey: ['staff', 'time-slots', state.fecha, state.servicio],
    queryFn: () => apiFetch<StaffTimeSlotDto[]>('/staff/time-slots', { query: { date: state.fecha, service: state.servicio } }),
  });

  if (slots.isError) return <ErrorState error={slots.error} onRetry={() => void slots.refetch()} />;
  if (slots.isPending) return <Skeleton className="h-64" />;
  if (slots.data.length === 0) {
    return <EmptyState title="Sin turnos" description={`No hay turnos de ${SERVICE_LABEL[state.servicio]} para este día.`} />;
  }

  const selected = slots.data.find((slot) => slot.id === state.turno) ?? slots.data[0];
  return (
    <>
      <SlotChips slots={slots.data} selectedId={selected.id} onSelect={(turno) => onNavigate({ ...state, turno })} />
      <div className="mt-6">
        <SlotDetail key={selected.id} slot={selected} today={today} />
      </div>
    </>
  );
}

export function TurnosView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = useBusinessToday();
  const pending = useQuery({
    queryKey: ['staff', 'time-slots', 'pending-attendance'],
    queryFn: () => apiFetch<StaffTimeSlotDto[]>('/staff/time-slots/pending-attendance'),
  });

  const fecha = parseBusinessDate(searchParams.get('fecha')) ?? today;
  const servicio = parseService(searchParams.get('servicio'));
  const turno = searchParams.get('turno') ?? undefined;
  const navigate = (state: UrlState) => router.replace(toUrl(state));

  return (
    <>
      <StaffPageHeader
        title="Turnos y asistencia"
        actions={
          fecha ? (
            <div className="flex flex-wrap items-center gap-3">
              <DateNavigator date={fecha} onChange={(next) => navigate({ fecha: next, servicio })} />
              <ServiceTabs value={servicio} onChange={(next) => navigate({ fecha, servicio: next })} />
            </div>
          ) : null
        }
      />
      <PendingAttendanceBanner slots={pending.data ?? []} isError={pending.isError} onRetry={() => void pending.refetch()} />
      {fecha ? <DayView state={{ fecha, servicio, turno }} today={today} onNavigate={navigate} /> : <Skeleton className="h-64" />}
    </>
  );
}
