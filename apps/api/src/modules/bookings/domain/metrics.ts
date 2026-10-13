import { addDays } from '../../../common/time/business-time.js';

const FREQUENCY_WINDOW_DAYS = 28;

export interface Frequencies {
  frequencyPerWeek: number;
  recentFrequency: number;
  baselineFrequency: number;
}

const countBetween = (dates: string[], from: string, to: string): number =>
  dates.filter((date) => date >= from && date <= to).length;

const roundTo1 = (value: number): number => Math.round(value * 10) / 10;

// First business date the R10 windows need, so callers load only that range.
export function metricsWindowStart(today: string, recentWeeks: number, baselineWeeks: number): string {
  const days = Math.max(FREQUENCY_WINDOW_DAYS, (recentWeeks + baselineWeeks) * 7);
  return addDays(today, -(days - 1));
}

// R10: `presentDates` are the business dates of `present` Performance attendances (one entry per attendance).
export function computeFrequencies(
  presentDates: string[],
  today: string,
  recentWeeks: number,
  baselineWeeks: number,
): Frequencies {
  const recentStart = addDays(today, -(recentWeeks * 7 - 1));
  const baselineEnd = addDays(recentStart, -1);
  const baselineStart = addDays(recentStart, -baselineWeeks * 7);
  return {
    frequencyPerWeek: roundTo1(countBetween(presentDates, addDays(today, -(FREQUENCY_WINDOW_DAYS - 1)), today) / 4),
    recentFrequency: countBetween(presentDates, recentStart, today) / recentWeeks,
    baselineFrequency: countBetween(presentDates, baselineStart, baselineEnd) / baselineWeeks,
  };
}
