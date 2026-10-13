'use client';

import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/move/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { MyStatsDto } from '@/lib/api/types';

function SummaryBody() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['me', 'stats'],
    queryFn: () => apiFetch<MyStatsDto>('/me/stats'),
  });

  if (isPending) return <Skeleton className="mt-5 h-20" />;
  if (isError) return <div className="mt-5"><ErrorState error={error} onRetry={() => void refetch()} /></div>;
  return (
    <dl className="mt-5 grid grid-cols-2 gap-4">
      <div className="rounded border border-border bg-soft p-4 text-center">
        <dd className="font-display text-2xl font-black">{data.attendances}</dd>
        <dt className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Asistencias</dt>
      </div>
      <div className="rounded border border-border bg-soft p-4 text-center">
        <dd className="font-display text-2xl font-black">{data.avgPerWeek.toFixed(1)}</dd>
        <dt className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Veces/semana</dt>
      </div>
    </dl>
  );
}

export function MonthSummary() {
  return (
    <section className="rounded border border-border bg-card p-6">
      <h2 className="text-sm font-semibold">Tu mes en MOVE</h2>
      <SummaryBody />
    </section>
  );
}
