'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AvailabilityDayDto } from '@/lib/api/types';
import { buttonVariants } from '@/components/ui/button';
import { addDaysWeb, formatWeekdayShort } from '@/lib/format';
import { cn } from '@/lib/utils';

const WEEK_DAYS = 7;

export function mondayOf(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDaysWeb(date, -((weekday + 6) % WEEK_DAYS));
}

interface WeekSelectorProps {
  weekStart: string;
  availability: AvailabilityDayDto[];
  value: string | null;
  onChange: (date: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  minDate: string;
  maxDate: string;
}

export function WeekSelector({
  weekStart,
  availability,
  value,
  onChange,
  onPrevWeek,
  onNextWeek,
  minDate,
  maxDate,
}: WeekSelectorProps) {
  const dates = Array.from({ length: WEEK_DAYS }, (_, index) => addDaysWeb(weekStart, index));
  const availableByDate = new Map(availability.map((day) => [day.date, day.available]));
  const isSelectable = (date: string) => date >= minDate && date <= maxDate && (availableByDate.get(date) ?? 0) > 0;

  return (
    <div>
      <div className="mb-3 flex justify-end gap-2">
        <button
          type="button"
          aria-label="Semana anterior"
          disabled={addDaysWeb(weekStart, -1) < minDate}
          onClick={onPrevWeek}
          className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Semana siguiente"
          disabled={addDaysWeb(weekStart, WEEK_DAYS) > maxDate}
          onClick={onNextWeek}
          className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center">
        {dates.map((date) => (
          <div key={`h-${date}`} className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {formatWeekdayShort(date)}
          </div>
        ))}
        {dates.map((date) => (
          <button
            key={date}
            type="button"
            disabled={!isSelectable(date)}
            aria-pressed={date === value}
            onClick={() => onChange(date)}
            className={cn(buttonVariants({ variant: date === value ? 'default' : 'outline' }), 'h-auto py-3')}
          >
            {Number(date.slice(8))}
          </button>
        ))}
      </div>
    </div>
  );
}
