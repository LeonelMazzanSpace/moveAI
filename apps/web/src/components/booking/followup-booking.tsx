'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { moveButtonSize } from '@/components/move/button-styles';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { AvailabilityDayDto, MeDto, PublicSettingsDto, TimeSlotDto } from '@/lib/api/types';
import { addDaysWeb, formatDayMonth, formatWeekdayLong } from '@/lib/format';
import { useBusinessToday } from './day-selector';
import { SlotList } from './slot-list';
import { useBookSlot } from './use-book-slot';
import { mondayOf, WeekSelector } from './week-selector';

const WEEK_DAYS = 7;

function FollowupDisabled() {
  return (
    <EmptyState
      title="Seguimiento no habilitado"
      description="El seguimiento fisioterapéutico se habilita después de tu evaluación."
      action={
        <Link href="/rehab" className="text-xs font-semibold underline underline-offset-4">
          Ver Rehab
        </Link>
      }
    />
  );
}

function FollowupPicker({ today, bookingWindowDays }: { today: string; bookingWindowDays: number }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [date, setDate] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const { book, pendingSlotId } = useBookSlot();

  const availability = useQuery({
    queryKey: ['availability', 'rehab', weekStart],
    queryFn: () =>
      apiFetch<AvailabilityDayDto[]>('/schedule/availability', {
        query: { service: 'rehab', from: weekStart, days: WEEK_DAYS },
      }),
  });
  const slots = useQuery({
    queryKey: ['time-slots', 'rehab', date],
    queryFn: () => apiFetch<TimeSlotDto[]>('/schedule/time-slots', { query: { service: 'rehab', date: date ?? '' } }),
    enabled: date !== null,
  });

  const changeWeek = (days: number) => setWeekStart((current) => addDaysWeb(current, days));
  const selectDate = (next: string) => {
    setDate(next);
    setSlotId(null);
  };

  if (availability.isError) return <ErrorState error={availability.error} onRetry={() => void availability.refetch()} />;

  return (
    <div className="space-y-7">
      {availability.isPending ? (
        <Skeleton className="h-28 rounded" />
      ) : (
        <WeekSelector
          weekStart={weekStart}
          availability={availability.data}
          value={date}
          onChange={selectDate}
          onPrevWeek={() => changeWeek(-WEEK_DAYS)}
          onNextWeek={() => changeWeek(WEEK_DAYS)}
          minDate={today}
          maxDate={addDaysWeb(today, bookingWindowDays)}
        />
      )}
      {date ? (
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Horarios disponibles — {formatWeekdayLong(date)} {formatDayMonth(date)}
          </p>
          <div className="mt-3">
            {slots.isPending ? <Skeleton className="h-8 rounded" /> : null}
            {slots.isError ? <ErrorState error={slots.error} onRetry={() => void slots.refetch()} /> : null}
            {slots.data ? <SlotList slots={slots.data} value={slotId} onChange={setSlotId} /> : null}
          </div>
        </div>
      ) : null}
      <Button
        disabled={slotId === null || pendingSlotId !== null}
        onClick={() => {
          if (slotId) book(slotId, { onSuccess: () => setSlotId(null) });
        }}
        className={moveButtonSize()}
      >
        Reservar
      </Button>
    </div>
  );
}

export function FollowupBooking() {
  const today = useBusinessToday();
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<MeDto>('/me') });
  const settings = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: () => apiFetch<PublicSettingsDto>('/settings/public'),
  });

  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  if (me.isPending || settings.isPending || !today) return <Skeleton className="h-64 rounded" />;
  if (!me.data.rehabFollowupEnabled) return <FollowupDisabled />;

  return <FollowupPicker today={today} bookingWindowDays={settings.data.bookingWindowDays} />;
}

export function FollowupCard() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<MeDto>('/me'), retry: false });
  if (me.data?.role !== 'client' || !me.data.rehabFollowupEnabled) return null;

  return (
    <Link href="/reservar/fisioterapia" className="rounded border border-border bg-card p-7 hover:bg-soft">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Fisioterapia</p>
      <p className="mt-3 font-display text-2xl font-black uppercase tracking-tight">Seguimiento</p>
      <p className="mt-3 text-sm text-muted-foreground">Reservá tu sesión de seguimiento con el profesional.</p>
    </Link>
  );
}
