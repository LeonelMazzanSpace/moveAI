'use client';

import { ErrorState } from '@/components/move/error-state';
import { SlotList } from '@/components/booking/slot-list';
import { WeekSelector } from '@/components/booking/week-selector';
import { Skeleton } from '@/components/ui/skeleton';
import type { PlanDto, TimeSlotDto } from '@/lib/api/types';
import { addDaysWeb, formatDateLong, formatDayMonth, formatTime, formatUYU, formatWeekdayLong } from '@/lib/format';
import type { SlotPickerState } from './use-checkout';

const WEEK_DAYS = 7;
const MS_PER_MINUTE = 60_000;

function durationMinutes(plan: PlanDto, slot: TimeSlotDto | null): number | null {
  if (plan.durationMinutes) return plan.durationMinutes;
  if (!slot) return null;
  return (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / MS_PER_MINUTE;
}

interface BookingSummaryProps {
  plan: PlanDto;
  slot: TimeSlotDto | null;
}

export function BookingSummary({ plan, slot }: BookingSummaryProps) {
  const minutes = durationMinutes(plan, slot);
  const rows: [string, string][] = [
    ['Servicio', plan.name],
    ['Fecha', slot ? formatDateLong(slot.startsAt) : '—'],
    ['Horario', slot ? formatTime(slot.startsAt) : '—'],
    ['Duración', minutes ? `${minutes} min` : '—'],
  ];

  return (
    <div className="rounded border border-border bg-card p-7">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Tu reserva</p>
      <dl className="mt-5 space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="font-display text-2xl font-black">{formatUYU(plan.price)}</span>
      </div>
    </div>
  );
}

export function SlotPicker({ picker }: { picker: SlotPickerState }) {
  const { settings, availability, slots, week, date, today, maxDate } = picker;

  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  if (availability.isError) return <ErrorState error={availability.error} onRetry={() => void availability.refetch()} />;
  if (!week || !today || !maxDate || !availability.data) return <Skeleton className="h-28 rounded" />;

  return (
    <div className="space-y-7">
      <WeekSelector
        weekStart={week}
        availability={availability.data}
        value={date}
        onChange={picker.selectDate}
        onPrevWeek={() => picker.shiftWeek(addDaysWeb(week, -WEEK_DAYS))}
        onNextWeek={() => picker.shiftWeek(addDaysWeb(week, WEEK_DAYS))}
        minDate={today}
        maxDate={maxDate}
      />
      {date ? (
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Horarios disponibles — {formatWeekdayLong(date)} {formatDayMonth(date)}
          </p>
          <div className="mt-3">
            {slots.isPending ? <Skeleton className="h-8 rounded" /> : null}
            {slots.isError ? <ErrorState error={slots.error} onRetry={() => void slots.refetch()} /> : null}
            {slots.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay horarios disponibles para este día.</p>
            ) : null}
            {slots.data ? <SlotList slots={slots.data} value={picker.slotId} onChange={picker.selectSlot} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
