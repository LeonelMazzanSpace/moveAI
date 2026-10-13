'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { PublicSettingsDto, TimeSlotDto } from '@/lib/api/types';
import { DaySelector, useBusinessToday } from './day-selector';
import { PlanRequiredNotice } from './plan-required-notice';
import { SlotGrid } from './slot-grid';
import { useBookSlot } from './use-book-slot';

const RENEW_HREF = '/planes?service=performance';

function ScheduleSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-[74px] rounded" />
      ))}
    </div>
  );
}

function DaySlots({ date }: { date: string }) {
  const { book, planRequired, pendingSlotId } = useBookSlot();
  const slots = useQuery({
    queryKey: ['time-slots', 'performance', date],
    queryFn: () => apiFetch<TimeSlotDto[]>('/schedule/time-slots', { query: { service: 'performance', date } }),
  });

  if (slots.isPending) return <ScheduleSkeleton />;
  if (slots.isError) return <ErrorState error={slots.error} onRetry={() => void slots.refetch()} />;
  if (slots.data.length === 0) return <EmptyState title="Sin horarios" description="No hay turnos publicados para este día." />;

  return (
    <div className="space-y-6">
      {planRequired ? <PlanRequiredNotice renewHref={RENEW_HREF} /> : null}
      <SlotGrid slots={slots.data} onBook={(slot) => book(slot.id)} pendingSlotId={pendingSlotId} />
    </div>
  );
}

export function PerformanceSchedule() {
  const today = useBusinessToday();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const settings = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: () => apiFetch<PublicSettingsDto>('/settings/public'),
  });
  const date = selectedDate ?? today;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight">Horarios y cupos.</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Reservá tu turno con un plan vigente. Cupos en tiempo real.
          </p>
        </div>
        {today && date && settings.data ? (
          <DaySelector from={today} days={settings.data.bookingWindowDays + 1} value={date} onChange={setSelectedDate} />
        ) : null}
      </div>
      <div className="mt-8">
        {settings.isError ? <ErrorState error={settings.error} onRetry={() => void settings.refetch()} /> : null}
        {!settings.isError && !date ? <ScheduleSkeleton /> : null}
        {!settings.isError && date ? <DaySlots key={date} date={date} /> : null}
      </div>
    </div>
  );
}
