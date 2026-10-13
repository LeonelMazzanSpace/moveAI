import Link from 'next/link';
import type { StaffTimeSlotDto } from '@/lib/api/types';
import { businessTodayWeb, formatDayMonth, formatTime, formatWeekdayShort } from '@/lib/format';
import { SERVICE_NAMES } from './slot-chips';

function slotHref(slot: StaffTimeSlotDto): string {
  const params = new URLSearchParams({
    fecha: businessTodayWeb(new Date(slot.startsAt)),
    servicio: slot.service,
    turno: slot.id,
  });
  return `/staff/turnos?${params.toString()}`;
}

function slotLabel(slot: StaffTimeSlotDto): string {
  const date = businessTodayWeb(new Date(slot.startsAt));
  return `${formatWeekdayShort(date)} ${formatDayMonth(date)} ${formatTime(slot.startsAt)} · ${SERVICE_NAMES[slot.service]} (${slot.pendingAttendance} sin marcar)`;
}

export function PendingAttendanceBanner({ slots }: { slots: StaffTimeSlotDto[] }) {
  if (slots.length === 0) return null;
  const title =
    slots.length === 1 ? 'Hay 1 turno con asistencia pendiente' : `Hay ${slots.length} turnos con asistencia pendiente`;
  return (
    <div role="status" className="mb-6 rounded border border-border bg-warning-muted px-6 py-4">
      <p className="text-sm font-semibold text-warning">{title}</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {slots.map((slot) => (
          <li key={slot.id}>
            <Link href={slotHref(slot)} className="underline underline-offset-4 hover:text-foreground">
              {slotLabel(slot)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
