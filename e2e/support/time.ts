// Fechas de negocio en la zona de Uruguay, calculadas a partir de "ahora": las pruebas no fijan fechas absolutas.
export const BUSINESS_TZ = 'America/Montevideo';

const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ });
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function businessDate(at: Date = new Date()): string {
  return dateFormat.format(at);
}

export function businessTime(at: Date): string {
  return timeFormat.format(at);
}

export function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// 1 = lunes … 7 = domingo.
export function isoWeekday(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7;
}

// "19/10/2026", como `formatDate` de la web.
export function displayDate(ymd: string): string {
  const [year, month, day] = ymd.split('-');
  return `${day}/${month}/${year}`;
}

// Semanas (de lunes a domingo) entre la de hoy y la de `ymd`, para el selector semanal de Rehab y Recovery.
export function weeksAhead(ymd: string, today: string = businessDate()): number {
  const mondayOf = (date: string) => addDays(date, 1 - isoWeekday(date));
  const diff = Date.parse(mondayOf(ymd)) - Date.parse(mondayOf(today));
  return Math.round(diff / (7 * 86_400_000));
}
