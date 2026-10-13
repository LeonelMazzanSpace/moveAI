'use client';

import { useSyncExternalStore } from 'react';
import { addDaysWeb, businessTodayWeb, formatDayMonth, formatWeekdayLong } from '@/lib/format';

const subscribeNever = () => () => undefined;

/** Fecha de hoy en Montevideo; `null` en el servidor para no congelar la hora en el prerender. */
export function useBusinessToday(): string | null {
  return useSyncExternalStore(subscribeNever, () => businessTodayWeb(), () => null);
}

interface DaySelectorProps {
  from: string;
  days: number;
  value: string;
  onChange: (date: string) => void;
}

export function DaySelector({ from, days, value, onChange }: DaySelectorProps) {
  const dates = Array.from({ length: days }, (_, index) => addDaysWeb(from, index));

  return (
    <label className="flex items-center gap-2 rounded border border-border bg-card px-3.5 py-2 text-xs font-medium">
      <span className="text-muted-foreground">Día:</span>
      <select
        aria-label="Día"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer bg-transparent text-xs font-medium outline-none"
      >
        {dates.map((date) => (
          <option key={date} value={date} className="bg-card">
            {formatWeekdayLong(date)} {formatDayMonth(date)}
          </option>
        ))}
      </select>
    </label>
  );
}
