import { BUSINESS_TZ } from '../../../common/time/business-time.js';
import { busyIntervals, overlaps, type GoogleEvent } from './busy-intervals.js';

const CALENDAR = 'move@group.calendar.google.com';

const timed = (overrides: Partial<GoogleEvent> = {}): GoogleEvent => ({
  id: 'e1',
  status: 'confirmed',
  start: { dateTime: '2026-10-14T10:00:00-03:00' },
  end: { dateTime: '2026-10-14T11:00:00-03:00' },
  ...overrides,
});

describe('busyIntervals', () => {
  it('turns a confirmed timed event into an interval', () => {
    expect(busyIntervals([timed()], CALENDAR, BUSINESS_TZ)).toEqual([
      { start: new Date('2026-10-14T13:00:00.000Z'), end: new Date('2026-10-14T14:00:00.000Z') },
    ]);
  });

  it('counts tentative events and events without transparency', () => {
    expect(busyIntervals([timed({ status: 'tentative' }), timed({ transparency: 'opaque' })], CALENDAR, BUSINESS_TZ)).toHaveLength(2);
  });

  it('blocks the whole Montevideo day for all-day events (end date is exclusive)', () => {
    const event = timed({ start: { date: '2026-10-14' }, end: { date: '2026-10-16' } });
    expect(busyIntervals([event], CALENDAR, BUSINESS_TZ)).toEqual([
      { start: new Date('2026-10-14T03:00:00.000Z'), end: new Date('2026-10-16T03:00:00.000Z') },
    ]);
  });

  it('ignores transparent (free) events', () => {
    expect(busyIntervals([timed({ transparency: 'transparent' })], CALENDAR, BUSINESS_TZ)).toEqual([]);
  });

  it('ignores cancelled events', () => {
    expect(busyIntervals([timed({ status: 'cancelled' })], CALENDAR, BUSINESS_TZ)).toEqual([]);
  });

  it('ignores the events MOVE created', () => {
    const own = timed({ extendedProperties: { private: { moveBookingId: 'booking-1' } } });
    expect(busyIntervals([own], CALENDAR, BUSINESS_TZ)).toEqual([]);
  });

  it('ignores events the calendar itself declined', () => {
    const bySelf = timed({ attendees: [{ email: 'other@test.move', responseStatus: 'accepted' }, { self: true, responseStatus: 'declined' }] });
    const byEmail = timed({ attendees: [{ email: CALENDAR, responseStatus: 'declined' }] });
    expect(busyIntervals([bySelf, byEmail], CALENDAR, BUSINESS_TZ)).toEqual([]);
  });

  it('keeps events declined only by other attendees', () => {
    const event = timed({ attendees: [{ email: 'other@test.move', responseStatus: 'declined' }, { self: true, responseStatus: 'accepted' }] });
    expect(busyIntervals([event], CALENDAR, BUSINESS_TZ)).toHaveLength(1);
  });

  it('ignores events without valid times or with an empty range', () => {
    const invalid = [
      timed({ start: {}, end: {} }),
      timed({ start: { dateTime: 'nope' } }),
      timed({ end: { dateTime: '2026-10-14T10:00:00-03:00' } }),
    ];
    expect(busyIntervals(invalid, CALENDAR, BUSINESS_TZ)).toEqual([]);
  });
});

describe('overlaps', () => {
  const slot = { startsAt: new Date('2026-10-14T13:00:00.000Z'), endsAt: new Date('2026-10-14T14:00:00.000Z') };
  const at = (start: string, end: string) => ({ start: new Date(start), end: new Date(end) });

  it('detects partial and full overlaps', () => {
    expect(overlaps(slot, [at('2026-10-14T13:30:00.000Z', '2026-10-14T15:00:00.000Z')])).toBe(true);
    expect(overlaps(slot, [at('2026-10-14T12:00:00.000Z', '2026-10-14T16:00:00.000Z')])).toBe(true);
    expect(overlaps(slot, [at('2026-10-14T13:15:00.000Z', '2026-10-14T13:45:00.000Z')])).toBe(true);
  });

  it('does not count intervals that only touch the slot', () => {
    expect(overlaps(slot, [at('2026-10-14T12:00:00.000Z', '2026-10-14T13:00:00.000Z')])).toBe(false);
    expect(overlaps(slot, [at('2026-10-14T14:00:00.000Z', '2026-10-14T15:00:00.000Z')])).toBe(false);
    expect(overlaps(slot, [])).toBe(false);
  });
});
