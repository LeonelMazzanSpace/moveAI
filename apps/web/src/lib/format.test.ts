import { describe, expect, it } from 'vitest';
import {
  businessDateOf,
  businessTodayWeb,
  formatDate,
  formatDateLong,
  formatDayMonth,
  formatTime,
  formatUYU,
  formatWeekdayLong,
  formatWeekdayShort,
  initials,
  SERVICE_LABEL,
} from './format';

describe('format', () => {
  it('formats UYU like the mockups', () => {
    expect(formatUYU(3900)).toBe('$ 3.900');
    expect(formatUYU(10500)).toBe('$ 10.500');
    expect(formatUYU(900)).toBe('$ 900');
  });

  it('formats dates and times in Montevideo', () => {
    expect(formatDate('2026-11-15')).toBe('15/11/2026');
    expect(formatDayMonth('2026-11-15')).toBe('15/11');
    expect(formatTime('2026-10-12T22:00:00.000Z')).toBe('19:00');
    expect(formatDateLong('2026-10-13')).toBe('Martes 13/10/2026');
    expect(businessTodayWeb(new Date('2026-10-13T02:00:00.000Z'))).toBe('2026-10-12');
  });

  it('builds initials', () => {
    expect(initials('Martina Suárez')).toBe('MS');
    expect(initials('diego')).toBe('D');
  });

  it('builds initials without splitting surrogate pairs', () => {
    expect(initials('𝓐lma 𝓑runo')).toBe('𝓐𝓑');
    expect(initials('😀 Ana')).toBe('😀A');
    expect(initials('   ')).toBe('');
  });

  it('names the rehab service "Fisioterapia" (R15)', () => {
    expect(SERVICE_LABEL.rehab).toBe('Fisioterapia');
    expect(SERVICE_LABEL.performance).toBe('Performance');
    expect(SERVICE_LABEL.recovery).toBe('Recovery');
  });

  it('returns a dash for dates that cannot be parsed', () => {
    expect(formatDate('')).toBe('—');
    expect(formatDate('no es una fecha')).toBe('—');
    expect(formatDate('2026-13-45')).toBe('—');
    expect(formatDate('2026-02-30')).toBe('—');
    expect(formatDate('2026-11-15T99:99:99Z')).toBe('—');
  });

  it.each(['', 'no es una fecha', '2026-13-45', '2026-11-15T99:99:99Z'])('shows a dash instead of throwing for %j', (value) => {
    expect(formatDayMonth(value)).toBe('—');
    expect(formatTime(value)).toBe('—');
    expect(formatWeekdayLong(value)).toBe('—');
    expect(formatWeekdayShort(value)).toBe('—');
    expect(formatDateLong(value)).toBe('—');
  });

  it('keeps formatting valid input after the guard', () => {
    expect(formatWeekdayLong('2026-10-13')).toBe('Martes');
    expect(formatWeekdayShort('2026-10-13')).toBe('Mar');
    expect(formatDayMonth('2026-11-16T00:00:00.000Z')).toBe('15/11');
    expect(formatTime('2026-11-16T02:30:00.000Z')).toBe('23:30');
  });

  describe('Montevideo day edges (UTC-3, no DST)', () => {
    it('keeps 21:00 of the 15th local on the 15th although UTC is already the 16th', () => {
      expect(formatDate('2026-11-16T00:00:00.000Z')).toBe('15/11/2026');
      expect(formatTime('2026-11-16T00:00:00.000Z')).toBe('21:00');
      expect(businessDateOf('2026-11-16T00:00:00.000Z')).toBe('2026-11-15');
    });

    it('counts 23:30 local for the local day', () => {
      expect(formatTime('2026-11-16T02:30:00.000Z')).toBe('23:30');
      expect(businessDateOf('2026-11-16T02:30:00.000Z')).toBe('2026-11-15');
    });

    it('switches day at 00:00 local (03:00 UTC)', () => {
      expect(businessTodayWeb(new Date('2026-11-16T02:59:59.000Z'))).toBe('2026-11-15');
      expect(businessTodayWeb(new Date('2026-11-16T03:00:00.000Z'))).toBe('2026-11-16');
      expect(formatDate('2026-11-16T03:00:00.000Z')).toBe('16/11/2026');
    });

    it('puts 07:00 local of the 16th on the 16th', () => {
      expect(formatTime('2026-11-16T10:00:00.000Z')).toBe('07:00');
      expect(businessDateOf('2026-11-16T10:00:00.000Z')).toBe('2026-11-16');
    });

    it('crosses month and year ends in local time', () => {
      expect(businessDateOf('2027-01-01T02:59:00.000Z')).toBe('2026-12-31');
      expect(businessDateOf('2027-01-01T03:00:00.000Z')).toBe('2027-01-01');
    });
  });
});
