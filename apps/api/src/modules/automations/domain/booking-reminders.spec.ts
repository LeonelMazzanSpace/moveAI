import { businessDateTime } from '../../../common/time/business-time.js';
import type { BookingModel } from '../../bookings/models/booking.model.js';
import { reminderWindow, selectBookingReminders } from './booking-reminders.js';

const booking = (id: string, overrides: Partial<BookingModel> = {}): BookingModel => ({
  id,
  userId: `user-${id}`,
  timeSlotId: `slot-${id}`,
  service: 'recovery',
  startsAt: businessDateTime('2026-10-15', '10:00'),
  endsAt: businessDateTime('2026-10-15', '10:45'),
  status: 'confirmed',
  source: 'package',
  subscriptionId: null,
  holdExpiresAt: null,
  cancelledAt: null,
  ...overrides,
});

const at = (date: string, time: string, service: BookingModel['service'] = 'recovery') =>
  ({ service, startsAt: businessDateTime(date, time), endsAt: businessDateTime(date, time) });

describe('reminderWindow', () => {
  it('spans the whole business day after today in Montevideo', () => {
    const { from, to } = reminderWindow('2026-10-14');
    expect(from).toEqual(businessDateTime('2026-10-15', '00:00'));
    expect(to.getTime()).toBe(businessDateTime('2026-10-16', '00:00').getTime() - 1);
  });
});

describe('selectBookingReminders', () => {
  const today = '2026-10-14';

  it('selects confirmed Rehab and Recovery bookings that start the next business day', () => {
    const result = selectBookingReminders(today, [
      booking('rec', at('2026-10-15', '10:00')),
      booking('reh', { ...at('2026-10-15', '16:00', 'rehab'), source: 'payment' }),
    ]);
    expect(result.map((b) => b.id)).toEqual(['rec', 'reh']);
  });

  it('keeps the midnight edge of Montevideo: 00:00 tomorrow is in, 23:59 tomorrow is in, 00:00 the day after is out', () => {
    const result = selectBookingReminders(today, [
      booking('first-minute', at('2026-10-15', '00:00')),
      booking('last-minute', at('2026-10-15', '23:59')),
      booking('day-after', at('2026-10-16', '00:00')),
      booking('last-minute-today', at('2026-10-14', '23:59')),
    ]);
    expect(result.map((b) => b.id)).toEqual(['first-minute', 'last-minute']);
  });

  it('decides the day in Montevideo, not in UTC (a 22:00 local slot is already the next day in UTC)', () => {
    const lateTomorrow = booking('late', at('2026-10-15', '22:30'));
    const lateToday = booking('late-today', at('2026-10-14', '22:30'));
    expect(lateTomorrow.startsAt.toISOString().slice(0, 10)).toBe('2026-10-16');
    expect(selectBookingReminders(today, [lateTomorrow, lateToday]).map((b) => b.id)).toEqual(['late']);
  });

  it('leaves Performance out', () => {
    const result = selectBookingReminders(today, [
      booking('perf', { ...at('2026-10-15', '19:00', 'performance'), source: 'plan' }),
    ]);
    expect(result).toEqual([]);
  });

  it('leaves out bookings that are not confirmed', () => {
    const result = selectBookingReminders(today, [
      booking('cancelled', { ...at('2026-10-15', '10:00'), status: 'cancelled' }),
      booking('pending', { ...at('2026-10-15', '10:30'), status: 'pending_payment' }),
      booking('expired', { ...at('2026-10-15', '11:00'), status: 'expired' }),
    ]);
    expect(result).toEqual([]);
  });
});
