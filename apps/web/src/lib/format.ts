import type { Service } from './api/types';

const TIME_ZONE = 'America/Montevideo';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const WEEKDAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const SERVICE_LABEL: Record<Service, string> = {
  performance: 'Performance',
  rehab: 'Fisioterapia',
  recovery: 'Recovery',
};

interface DateParts {
  year: number;
  month: number;
  day: number;
}

const instantFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function instantParts(instant: Date): DateParts & { hour: string; minute: string } {
  const parts = Object.fromEntries(instantFormatter.formatToParts(instant).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour,
    minute: parts.minute,
  };
}

function dateParts(value: string): DateParts {
  if (DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return { year, month, day };
  }
  const { year, month, day } = instantParts(new Date(value));
  return { year, month, day };
}

function isCalendarDate({ year, month, day }: DateParts): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Null when the value is neither a real YYYY-MM-DD date nor a parseable instant.
function validDateParts(value: string): DateParts | null {
  if (!DATE_ONLY.test(value) && Number.isNaN(new Date(value).getTime())) return null;
  const parts = dateParts(value);
  return isCalendarDate(parts) ? parts : null;
}

const pad = (n: number): string => String(n).padStart(2, '0');

function toIsoDate({ year, month, day }: DateParts): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function weekdayIndex({ year, month, day }: DateParts): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function formatUYU(n: number): string {
  const formatted = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0, useGrouping: 'always' }).format(n);
  return `$ ${formatted}`;
}

export function formatDate(d: string): string {
  const parts = validDateParts(d);
  if (!parts) return '—';
  const { year, month, day } = parts;
  return `${pad(day)}/${pad(month)}/${year}`;
}

export function formatDayMonth(d: string): string {
  const { month, day } = dateParts(d);
  return `${pad(day)}/${pad(month)}`;
}

export function formatTime(iso: string): string {
  const { hour, minute } = instantParts(new Date(iso));
  return `${hour}:${minute}`;
}

export function formatWeekdayLong(d: string): string {
  return WEEKDAYS_LONG[weekdayIndex(dateParts(d))];
}

export function formatWeekdayShort(d: string): string {
  return formatWeekdayLong(d).slice(0, 3);
}

export function formatDateLong(d: string): string {
  return `${formatWeekdayLong(d)} ${formatDate(d)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join('');
}

export function businessTodayWeb(now: Date = new Date()): string {
  return toIsoDate(instantParts(now));
}

export function businessDateOf(instant: string): string {
  return businessTodayWeb(new Date(instant));
}

export function addDaysWeb(date: string, n: number): string {
  const { year, month, day } = dateParts(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + n));
  return toIsoDate({ year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() });
}
