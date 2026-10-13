import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export const BUSINESS_TZ = 'America/Montevideo';
const DAY_MS = 86_400_000;

const parseDate = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const formatDate = (value: Date): string => value.toISOString().slice(0, 10);

export function toBusinessDate(instant: Date): string {
  return format(new TZDate(instant.getTime(), BUSINESS_TZ), 'yyyy-MM-dd');
}

export function businessToday(now: Date = new Date()): string {
  return toBusinessDate(now);
}

export function businessDateTime(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss = 0] = time.split(':').map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, ss, BUSINESS_TZ).getTime());
}

export function businessDayStart(date: string): Date {
  return businessDateTime(date, '00:00');
}

export function businessDayEnd(date: string): Date {
  return new Date(businessDayStart(addDays(date, 1)).getTime() - 1);
}

export function addDays(date: string, days: number): string {
  return formatDate(new Date(parseDate(date).getTime() + days * DAY_MS));
}

export function addMonths(date: string, months: number): string {
  const base = parseDate(date);
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(base.getUTCDate(), lastDay));
  return formatDate(target);
}

export function diffDays(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY_MS);
}

export function isoWeekday(date: string): number {
  const day = parseDate(date).getUTCDay();
  return day === 0 ? 7 : day;
}

export function businessTime(instant: Date): string {
  return format(new TZDate(instant.getTime(), BUSINESS_TZ), 'HH:mm');
}

export function businessMonth(date: string): string {
  return date.slice(0, 7);
}

export function isFirstMondayOfMonth(date: string): boolean {
  return isoWeekday(date) === 1 && Number(date.slice(8, 10)) <= 7;
}
