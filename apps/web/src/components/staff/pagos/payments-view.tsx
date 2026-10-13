'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, FormField, SELECT_CLASS } from '@/components/staff/config/plan-form';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { Paginated, PaymentMethod, PurchaseStatus, StaffPaymentDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { ManualPaymentDialog } from './manual-payment-dialog';
import { METHOD_LABEL, PaymentsTable } from './payments-table';

export const PAGE_SIZE = 20;

export type PaymentStatusFilter = Extract<PurchaseStatus, 'approved' | 'pending' | 'rejected' | 'expired'>;

export interface PaymentFilters {
  status: PaymentStatusFilter | null;
  method: PaymentMethod | null;
  needsAttention: boolean;
  page: number;
}

const STATUS_OPTIONS: { value: PaymentStatusFilter; label: string }[] = [
  { value: 'approved', label: 'Aprobados' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'rejected', label: 'Rechazados' },
  { value: 'expired', label: 'Expirados' },
];

const METHODS = Object.keys(METHOD_LABEL) as PaymentMethod[];

const MAX_PAGE = 10_000;

export function clampPage(raw: string | undefined): number {
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, MAX_PAGE);
}

function findOption<T extends string>(values: readonly T[], raw: string): T | null {
  return values.find((value) => value === raw) ?? null;
}

const STATUS_VALUES = STATUS_OPTIONS.map((option) => option.value);

function pageHref(filters: PaymentFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('estado', filters.status);
  if (filters.method) params.set('metodo', filters.method);
  if (filters.needsAttention) params.set('atencion', '1');
  if (filters.page > 1) params.set('pagina', String(filters.page));
  const search = params.toString();
  return `/staff/pagos${search ? `?${search}` : ''}`;
}

export function PaymentsView({ filters }: { filters: PaymentFilters }) {
  const uid = useId();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['staff', 'payments', filters],
    queryFn: () =>
      apiFetch<Paginated<StaffPaymentDto>>('/staff/payments', {
        query: {
          status: filters.status ?? undefined,
          method: filters.method ?? undefined,
          needsAttention: filters.needsAttention ? true : undefined,
          page: filters.page,
          pageSize: PAGE_SIZE,
        },
      }),
  });

  const navigate = (changes: Partial<PaymentFilters>) =>
    router.replace(pageHref({ ...filters, page: 1, ...changes }), { scroll: false });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-44">
            <FormField id={`${uid}-status`} label="Estado">
              <select
                id={`${uid}-status`}
                className={SELECT_CLASS}
                value={filters.status ?? ''}
                onChange={(event) => navigate({ status: findOption(STATUS_VALUES, event.target.value) })}
              >
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="w-44">
            <FormField id={`${uid}-method`} label="Método">
              <select
                id={`${uid}-method`}
                className={SELECT_CLASS}
                value={filters.method ?? ''}
                onChange={(event) => navigate({ method: findOption(METHODS, event.target.value) })}
              >
                <option value="">Todos</option>
                {METHODS.map((method) => (
                  <option key={method} value={method}>
                    {METHOD_LABEL[method]}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <button
            type="button"
            aria-pressed={filters.needsAttention}
            className={cn(
              'rounded px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]',
              filters.needsAttention ? 'bg-warning-muted text-warning' : 'border border-border text-foreground hover:bg-card',
            )}
            onClick={() => navigate({ needsAttention: !filters.needsAttention })}
          >
            Requieren atención
          </button>
        </div>
        <button type="button" className={BUTTON_PRIMARY} onClick={() => setDialogOpen(true)}>
          Registrar pago manual
        </button>
      </div>

      {isPending ? <Skeleton className="h-80" /> : null}
      {!isPending && (error || !data) ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {data && data.items.length === 0 ? (
        <EmptyState title="Sin pagos" description="No hay operaciones que coincidan con los filtros." />
      ) : null}
      {data && data.items.length > 0 ? <PaymentsTable payments={data.items} /> : null}
      {data && (data.items.length > 0 || data.page > 1) ? (
        <nav aria-label="Paginación" className="flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground">
            Página {data.page} de {totalPages}
          </span>
          <button
            type="button"
            className={BUTTON_OUTLINE}
            disabled={data.page <= 1}
            onClick={() => navigate({ page: Math.min(data.page - 1, totalPages) })}
          >
            Anterior
          </button>
          <button
            type="button"
            className={BUTTON_OUTLINE}
            disabled={data.page >= totalPages}
            onClick={() => navigate({ page: data.page + 1 })}
          >
            Siguiente
          </button>
        </nav>
      ) : null}

      <ManualPaymentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
