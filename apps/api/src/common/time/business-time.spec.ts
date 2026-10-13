import {
  addDays, addMonths, businessDateTime, businessDayEnd, businessDayStart, businessMonth, businessTime,
  businessToday, diffDays, isFirstMondayOfMonth, isoWeekday, toBusinessDate,
} from './business-time.js';

describe('business-time (America/Montevideo, UTC-3)', () => {
  it('maps late-evening local instants to the local date', () => {
    expect(toBusinessDate(new Date('2026-11-16T00:00:00.000Z'))).toBe('2026-11-15'); // 21:00 local
    expect(toBusinessDate(new Date('2026-11-16T02:30:00.000Z'))).toBe('2026-11-15'); // 23:30 local
    expect(toBusinessDate(new Date('2026-11-16T03:00:00.000Z'))).toBe('2026-11-16'); // 00:00 local
  });

  it('computes today in Montevideo', () => {
    expect(businessToday(new Date('2026-10-13T02:00:00.000Z'))).toBe('2026-10-12');
  });

  it('builds instants from local date and time', () => {
    expect(businessDateTime('2026-10-12', '19:00').toISOString()).toBe('2026-10-12T22:00:00.000Z');
    expect(businessDayStart('2026-10-12').toISOString()).toBe('2026-10-12T03:00:00.000Z');
    expect(businessDayEnd('2026-10-12').toISOString()).toBe('2026-10-13T02:59:59.999Z');
    expect(businessTime(new Date('2026-10-12T22:00:00.000Z'))).toBe('19:00');
  });

  it('does calendar math on business dates', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addMonths('2026-08-15', 3)).toBe('2026-11-15');
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(diffDays('2026-10-12', '2026-11-15')).toBe(34);
    expect(diffDays('2026-11-15', '2026-11-15')).toBe(0);
    expect(isoWeekday('2026-10-12')).toBe(1);
    expect(isoWeekday('2026-10-18')).toBe(7);
    expect(businessMonth('2026-10-12')).toBe('2026-10');
  });

  it('detects the first Monday of the month', () => {
    expect(isFirstMondayOfMonth('2026-10-05')).toBe(true);
    expect(isFirstMondayOfMonth('2026-10-12')).toBe(false);
    expect(isFirstMondayOfMonth('2026-11-02')).toBe(true);
  });
});
