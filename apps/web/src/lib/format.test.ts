import { describe, expect, it } from 'vitest';
import { formatDate, formatDateLong, formatDayMonth, formatTime, formatUYU, initials, businessTodayWeb } from './format';

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
});
