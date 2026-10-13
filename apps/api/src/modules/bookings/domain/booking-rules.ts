import { addDays, toBusinessDate } from '../../../common/time/business-time.js';
import type { Service } from '../../catalog/entities/plan.entity.js';
import type { BookingSource, BookingStatus } from '../entities/booking.entity.js';

const HOUR_MS = 3_600_000;

// R15: visible service names.
export const SERVICE_LABEL: Record<Service, string> = {
  performance: 'Performance',
  rehab: 'Fisioterapia',
  recovery: 'Recovery',
};

export const ACTIVE_STATUSES: BookingStatus[] = ['pending_payment', 'confirmed'];

// D20: bookings paid one by one are cancelled by staff only.
const CLIENT_CANCELLABLE_SOURCES: BookingSource[] = ['plan', 'package', 'followup'];

export function isClientCancellable(status: BookingStatus, source: BookingSource): boolean {
  return status === 'confirmed' && CLIENT_CANCELLABLE_SOURCES.includes(source);
}

export function isWithinCancelWindow(startsAt: Date, now: Date, cancelLimitHours: number): boolean {
  return now.getTime() <= startsAt.getTime() - cancelLimitHours * HOUR_MS;
}

// R7: the client rule, also exposed as `canCancel`.
export function canClientCancel(input: {
  status: BookingStatus;
  source: BookingSource;
  startsAt: Date;
  now: Date;
  cancelLimitHours: number;
}): boolean {
  return isClientCancellable(input.status, input.source) && isWithinCancelWindow(input.startsAt, input.now, input.cancelLimitHours);
}

// R15.
export function bookingLabel(service: Service, source: BookingSource, durationMinutes: number): string {
  if (service === 'performance') return 'Entrenamiento semi personalizado';
  if (service === 'recovery') return `Sesión Recovery · ${durationMinutes} min`;
  if (source === 'payment') return `Evaluación y Diagnóstico · ${durationMinutes} min`;
  return `Seguimiento fisioterapéutico · ${durationMinutes} min`;
}

// R6 step 2: not cancelled, not started and inside the booking window (business dates).
export function isBookable(
  slot: { startsAt: Date; cancelledAt: Date | null },
  now: Date,
  today: string,
  bookingWindowDays: number,
): boolean {
  if (slot.cancelledAt) return false;
  if (slot.startsAt.getTime() <= now.getTime()) return false;
  return toBusinessDate(slot.startsAt) <= addDays(today, bookingWindowDays);
}

export function durationMinutes(startsAt: Date, endsAt: Date): number {
  return Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
}

// 'YYYY-MM-DD' → 'DD/MM/YYYY' (Email contract).
export function displayDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}
