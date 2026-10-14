import { bookingLabel, canClientCancel, isBookable } from './booking-rules.js';

describe('booking rules', () => {
  const startsAt = new Date('2026-10-14T21:00:00.000Z'); // 18:00 local
  it('lets clients cancel plan, package and followup bookings until the limit', () => {
    const base = { status: 'confirmed' as const, startsAt, cancelLimitHours: 2 };
    expect(canClientCancel({ ...base, source: 'plan', now: new Date('2026-10-14T19:00:00.000Z') })).toBe(true);
    expect(canClientCancel({ ...base, source: 'plan', now: new Date('2026-10-14T19:00:01.000Z') })).toBe(false);
    expect(canClientCancel({ ...base, source: 'payment', now: new Date('2026-10-13T00:00:00.000Z') })).toBe(false);
    expect(canClientCancel({ ...base, status: 'cancelled', source: 'plan', now: new Date('2026-10-13T00:00:00.000Z') })).toBe(false);
  });

  it('labels bookings', () => {
    expect(bookingLabel('performance', 'plan', 60)).toBe('Entrenamiento semi personalizado');
    expect(bookingLabel('recovery', 'package', 45)).toBe('Sesión Recovery · 45 min');
    expect(bookingLabel('rehab', 'payment', 60)).toBe('Evaluación y Diagnóstico · 60 min');
    expect(bookingLabel('rehab', 'followup', 60)).toBe('Seguimiento fisioterapéutico · 60 min');
  });

  it('checks the booking window in business dates', () => {
    const slot = { startsAt: new Date('2026-10-27T00:00:00.000Z'), cancelledAt: null, calendarBlockedAt: null }; // 26/10 21:00 local
    expect(isBookable(slot, new Date('2026-10-12T15:00:00.000Z'), '2026-10-12', 14)).toBe(true);
    expect(isBookable(slot, new Date('2026-10-12T15:00:00.000Z'), '2026-10-11', 14)).toBe(false);
    expect(isBookable({ ...slot, cancelledAt: new Date() }, new Date('2026-10-12T15:00:00.000Z'), '2026-10-12', 14)).toBe(false);
  });

  it('never lets a slot busy in Google Calendar be booked (D94)', () => {
    const slot = { startsAt: new Date('2026-10-14T13:00:00.000Z'), cancelledAt: null, calendarBlockedAt: null };
    const now = new Date('2026-10-12T15:00:00.000Z');
    expect(isBookable(slot, now, '2026-10-12', 14)).toBe(true);
    expect(isBookable({ ...slot, calendarBlockedAt: now }, now, '2026-10-12', 14)).toBe(false);
  });
});

describe('booking rules edge cases', () => {
  const now = new Date('2026-10-12T15:00:00.000Z');

  it('never lets a started slot be booked', () => {
    expect(isBookable({ startsAt: now, cancelledAt: null, calendarBlockedAt: null }, now, '2026-10-12', 14)).toBe(false);
    expect(isBookable({ startsAt: new Date(now.getTime() + 1), cancelledAt: null, calendarBlockedAt: null }, now, '2026-10-12', 14))
      .toBe(true);
  });

  it('only lets clients cancel confirmed bookings', () => {
    const base = { source: 'followup' as const, startsAt: new Date('2026-10-14T21:00:00.000Z'), now, cancelLimitHours: 2 };
    expect(canClientCancel({ ...base, status: 'confirmed' })).toBe(true);
    expect(canClientCancel({ ...base, status: 'pending_payment' })).toBe(false);
    expect(canClientCancel({ ...base, status: 'expired' })).toBe(false);
  });
});
