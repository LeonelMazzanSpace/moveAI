'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/api/client';
import type { ActivityItemDto, Paginated } from '@/lib/api/types';
import { formatDate, formatUYU } from '@/lib/format';

type ActivityFilter = 'all' | 'bookings' | 'payments';

const FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'bookings', label: 'Reservas' },
  { value: 'payments', label: 'Pagos' },
];

const EMPTY_TITLE: Record<ActivityFilter, string> = {
  all: 'Todavía no tenés actividad',
  bookings: 'Todavía no tenés reservas',
  payments: 'Todavía no tenés pagos',
};

const COMPACT_PAGE_SIZE = 5;
const FULL_PAGE_SIZE = 20;

function isFilter(value: unknown): value is ActivityFilter {
  return FILTERS.some((filter) => filter.value === value);
}

function itemText(item: ActivityItemDto): string {
  return item.amount === null ? item.label : `${item.label} · ${formatUYU(item.amount)}`;
}

function ActivityRows({ items }: { items: ActivityItemDto[] }) {
  return (
    <ul className="divide-y divide-border text-sm">
      {items.map((item, index) => (
        <li key={`${item.type}-${item.date}-${index}`} className="flex items-center justify-between gap-4 px-7 py-3.5">
          <span>{itemText(item)}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.date)}</span>
        </li>
      ))}
    </ul>
  );
}

function Pager({ page, data, onPage }: { page: number; data: Paginated<ActivityItemDto>; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="flex items-center justify-between border-t border-border px-7 py-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Anterior
      </Button>
      <span className="text-xs text-muted-foreground">{`Página ${page} de ${pages}`}</span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Siguiente
      </Button>
    </div>
  );
}

interface ActivityListProps {
  variant?: 'compact' | 'full';
}

export function ActivityList({ variant = 'compact' }: ActivityListProps) {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [page, setPage] = useState(1);
  const full = variant === 'full';
  const pageSize = full ? FULL_PAGE_SIZE : COMPACT_PAGE_SIZE;

  const { data, isPending, isPlaceholderData, isError, error, refetch } = useQuery({
    queryKey: ['me', 'activity', filter, page, pageSize],
    queryFn: () =>
      apiFetch<Paginated<ActivityItemDto>>('/me/activity', { query: { type: filter, page, pageSize } }),
    placeholderData: keepPreviousData,
  });

  const changeFilter = (value: unknown) => {
    if (!isFilter(value)) return;
    setFilter(value);
    setPage(1);
  };

  return (
    <div className="rounded border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-7 py-4">
        <h2 className="text-sm font-semibold">Historial de actividad</h2>
        <div className="flex items-center gap-4">
          <Tabs value={filter} onValueChange={changeFilter}>
            <TabsList className="group-data-horizontal/tabs:h-10">
              {FILTERS.map(({ value, label }) => (
                <TabsTrigger key={value} value={value}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {full ? null : (
            <Link href="/historial" className="inline-flex min-h-8 items-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
              Ver todo
            </Link>
          )}
        </div>
      </div>
      {isPending ? <Skeleton className="m-7 h-28" /> : null}
      {isPlaceholderData ? (
        <p role="status" className="px-7 pt-3 text-xs text-muted-foreground">
          Actualizando…
        </p>
      ) : null}
      {isError ? <div className="p-4"><ErrorState error={error} onRetry={() => void refetch()} /></div> : null}
      {data && data.items.length === 0 ? <div className="p-4"><EmptyState title={EMPTY_TITLE[filter]} /></div> : null}
      {data && data.items.length > 0 ? <ActivityRows items={data.items} /> : null}
      {full && data && data.total > data.pageSize ? <Pager page={page} data={data} onPage={setPage} /> : null}
    </div>
  );
}
