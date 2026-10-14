import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { StaffTimeSlotDto } from '@/lib/api/types';
import { businessDateOf, formatDayMonth, formatTime, formatWeekdayShort, SERVICE_LABEL } from '@/lib/format';

function slotHref(slot: StaffTimeSlotDto): string {
  const fecha = businessDateOf(slot.startsAt);
  const params = new URLSearchParams();
  if (fecha) params.set('fecha', fecha);
  params.set('servicio', slot.service);
  params.set('turno', slot.id);
  return `/staff/turnos?${params.toString()}`;
}

function slotLabel(slot: StaffTimeSlotDto): string {
  const date = businessDateOf(slot.startsAt) ?? '';
  return `${formatWeekdayShort(date)} ${formatDayMonth(date)} ${formatTime(slot.startsAt)} · ${SERVICE_LABEL[slot.service]} (${slot.pendingAttendance} sin marcar)`;
}

interface PendingAttendanceBannerProps {
  slots: StaffTimeSlotDto[];
  isError?: boolean;
  onRetry?: () => void;
}

export function PendingAttendanceBanner({ slots, isError = false, onRetry }: PendingAttendanceBannerProps) {
  if (isError) {
    return (
      <div role="alert" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded border border-border bg-danger-muted px-6 py-3">
        <p className="text-sm text-danger">No pudimos cargar los turnos con asistencia pendiente.</p>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        ) : null}
      </div>
    );
  }
  if (slots.length === 0) return null;
  const title =
    slots.length === 1 ? 'Hay 1 turno con asistencia pendiente' : `Hay ${slots.length} turnos con asistencia pendiente`;
  return (
    <div role="status" className="mb-6 rounded border border-border bg-warning-muted px-6 py-4">
      <p className="text-sm font-semibold text-warning">{title}</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {slots.map((slot) => (
          <li key={slot.id}>
            <Link href={slotHref(slot)} className="inline-flex min-h-8 items-center underline underline-offset-4 hover:text-foreground">
              {slotLabel(slot)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
