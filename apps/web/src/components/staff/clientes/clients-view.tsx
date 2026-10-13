'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { StaffPageHeader } from '@/components/move/staff-page-header';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { ClientKpisDto, ClientRowDto, Paginated } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { ClientKpis } from './client-kpis';
import { ClientsTable } from './clients-table';
import { parseStatusFilter, StatusFilter, type ClientStatusFilter } from './status-filter';

const PATH = '/staff/clientes';
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

interface UrlState {
  q: string;
  status: ClientStatusFilter;
  page: number;
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

function toUrl({ q, status, page }: UrlState): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status !== 'all') params.set('status', status);
  if (page > 1) params.set('page', String(page));
  const search = params.toString();
  return search ? `${PATH}?${search}` : PATH;
}

interface SearchBoxProps {
  initialValue: string;
  onSearch: (q: string) => void;
}

function SearchBox({ initialValue, onSearch }: SearchBoxProps) {
  const [value, setValue] = useState(initialValue);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function handleChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next.trim()), SEARCH_DEBOUNCE_MS);
  }

  return (
    <div className="relative w-72">
      <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label="Buscar clientes"
        placeholder="Buscar por nombre, email o plan…"
        value={value}
        className="h-auto rounded border-border bg-card py-2 pl-9 text-xs"
        onChange={(event) => handleChange(event.target.value)}
      />
    </div>
  );
}

interface PaginationProps {
  shown: number;
  total: number;
  page: number;
  onPageChange: (page: number) => void;
}

function Pagination({ shown, total, page, onPageChange }: PaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buttonClass = 'rounded border border-border px-3 py-1.5 disabled:opacity-50';
  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
      <span>
        Mostrando {shown} de {total} clientes
      </span>
      <div className="flex gap-1">
        <button type="button" aria-label="Página anterior" className={buttonClass} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          ←
        </button>
        <button type="button" aria-label="Página siguiente" className={buttonClass} disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
          →
        </button>
      </div>
    </div>
  );
}

function Kpis() {
  const kpis = useQuery({ queryKey: ['staff', 'clients', 'kpis'], queryFn: () => apiFetch<ClientKpisDto>('/staff/clients/kpis') });
  if (kpis.isError) return <ErrorState error={kpis.error} onRetry={() => void kpis.refetch()} />;
  if (kpis.isPending) return <Skeleton className="h-28" />;
  return <ClientKpis kpis={kpis.data} />;
}

function ClientList({ state, onPageChange }: { state: UrlState; onPageChange: (page: number) => void }) {
  const clients = useQuery({
    queryKey: ['staff', 'clients', 'list', state],
    queryFn: () =>
      apiFetch<Paginated<ClientRowDto>>('/staff/clients', {
        query: { q: state.q || undefined, status: state.status === 'all' ? undefined : state.status, page: state.page, pageSize: PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  });

  if (clients.isError) return <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />;
  if (clients.isPending) return <Skeleton className="h-64" />;
  if (clients.data.items.length === 0) {
    return <EmptyState title="Sin clientes" description="No hay clientes que coincidan con la búsqueda o el filtro." />;
  }
  return (
    <div className="overflow-hidden rounded border border-border bg-card">
      <ClientsTable rows={clients.data.items} />
      <Pagination shown={clients.data.items.length} total={clients.data.total} page={state.page} onPageChange={onPageChange} />
    </div>
  );
}

export function ClientsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state: UrlState = {
    q: searchParams.get('q') ?? '',
    status: parseStatusFilter(searchParams.get('status')),
    page: parsePage(searchParams.get('page')),
  };
  const navigate = (next: UrlState) => router.replace(toUrl(next));

  return (
    <>
      <StaffPageHeader
        title="Clientes"
        actions={
          <>
            <SearchBox initialValue={state.q} onSearch={(q) => navigate({ ...state, q, page: 1 })} />
            <Link href="/staff/clientes/nuevo" className={cn(buttonVariants(), 'h-auto px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]')}>
              Nuevo cliente
            </Link>
          </>
        }
      />
      <Kpis />
      <div className="mt-6">
        <StatusFilter value={state.status} onChange={(status) => navigate({ ...state, status, page: 1 })} />
      </div>
      <div className="mt-4">
        <ClientList state={state} onPageChange={(page) => navigate({ ...state, page })} />
      </div>
    </>
  );
}
