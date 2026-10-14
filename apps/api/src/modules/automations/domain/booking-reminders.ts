import { addDays, businessDayEnd, businessDayStart, toBusinessDate } from '../../../common/time/business-time.js';
import type { Service } from '../../catalog/entities/plan.entity.js';
import type { BookingModel } from '../../bookings/models/booking.model.js';

const REMINDER_SERVICES: Service[] = ['rehab', 'recovery'];

// D93: the reminder goes out the day before, so it covers the whole next business day in Montevideo.
export function reminderWindow(today: string): { from: Date; to: Date } {
  const tomorrow = addDays(today, 1);
  return { from: businessDayStart(tomorrow), to: businessDayEnd(tomorrow) };
}

// Confirmed Rehab and Recovery bookings that start tomorrow. Paused clients are included on purpose: the reminder is
// transactional, not a retention email (D93).
export function selectBookingReminders(today: string, bookings: BookingModel[]): BookingModel[] {
  const tomorrow = addDays(today, 1);
  return bookings.filter(
    (booking) =>
      booking.status === 'confirmed' &&
      REMINDER_SERVICES.includes(booking.service) &&
      toBusinessDate(booking.startsAt) === tomorrow,
  );
}
