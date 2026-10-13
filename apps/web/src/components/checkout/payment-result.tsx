'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { PurchaseStatusDto } from '@/lib/api/types';
import { formatDateLong, formatTime, formatUYU } from '@/lib/format';
import { cn } from '@/lib/utils';

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20;
const CTA_CLASS = cn(buttonVariants(), 'h-auto px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em]');
const SECONDARY_CTA_CLASS = cn(buttonVariants({ variant: 'outline' }), 'h-auto px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em]');

function retryHref({ kind, service, planSlug }: PurchaseStatusDto): string {
  if (kind === 'booking') return `/${service}#reservar`;
  return planSlug ? `/checkout/plan/${planSlug}` : `/planes?service=${service}`;
}

function ResultCard({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-card p-7">
      <p className="font-display text-2xl font-black uppercase tracking-tight">{title}</p>
      {children}
    </div>
  );
}

function ApprovedDetail({ status }: { status: PurchaseStatusDto }) {
  return (
    <dl className="mt-5 space-y-3 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">{status.kind === 'booking' ? 'Turno' : 'Plan'}</dt>
        <dd className="text-right font-medium">{status.itemName}</dd>
      </div>
      {status.startsAt ? (
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Fecha y hora</dt>
          <dd className="text-right font-medium">{`${formatDateLong(status.startsAt)} · ${formatTime(status.startsAt)}`}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Total</dt>
        <dd className="text-right font-medium">{formatUYU(status.amount)}</dd>
      </div>
    </dl>
  );
}

interface PaymentResultViewProps {
  status: PurchaseStatusDto;
  timedOut: boolean;
}

function PlanRetry({ status }: { status: PurchaseStatusDto }) {
  return (
    <>
      <p className="mt-3 text-sm text-muted-foreground">Si tu pago fue rechazado, podés intentarlo de nuevo.</p>
      <Link href={retryHref(status)} className={cn(SECONDARY_CTA_CLASS, 'mt-6')}>
        Intentar de nuevo
      </Link>
    </>
  );
}

export function PaymentResultView({ status, timedOut }: PaymentResultViewProps) {
  if (status.needsAttention) {
    return (
      <ResultCard title="Revisamos tu pago">
        <p className="mt-3 text-sm text-muted-foreground">
          Recibimos tu pago pero necesitamos revisarlo. El equipo de MOVE te va a contactar.
        </p>
      </ResultCard>
    );
  }

  if (status.status === 'approved') {
    return (
      <ResultCard title="¡Listo! Tu pago fue aprobado.">
        <ApprovedDetail status={status} />
        {status.kind === 'booking' ? (
          <p className="mt-5 text-sm text-muted-foreground">Te enviamos la confirmación por email.</p>
        ) : null}
        <Link href="/perfil" className={cn(CTA_CLASS, 'mt-6')}>
          Ir a mi perfil
        </Link>
      </ResultCard>
    );
  }

  if (status.status === 'pending') {
    return (
      <ResultCard title={timedOut ? 'Pago en proceso' : 'Confirmando tu pago'}>
        <p className="mt-3 text-sm text-muted-foreground">
          {timedOut
            ? 'Tu pago está en proceso. Te avisamos por email cuando se acredite.'
            : 'Estamos esperando la confirmación de Mercado Pago. No cierres esta página.'}
        </p>
        {timedOut && status.kind === 'plan' ? <PlanRetry status={status} /> : null}
      </ResultCard>
    );
  }

  return (
    <ResultCard title="Pago no completado">
      <p className="mt-3 text-sm text-muted-foreground">El pago no se completó.</p>
      <Link href={retryHref(status)} className={cn(SECONDARY_CTA_CLASS, 'mt-6')}>
        Intentar de nuevo
      </Link>
    </ResultCard>
  );
}

/** Cada consulta cuenta, salga bien o mal: así los errores persistentes también terminan el polling. */
function attemptsOf(state: { dataUpdateCount: number; errorUpdateCount: number } | undefined): number {
  return state ? state.dataUpdateCount + state.errorUpdateCount : 0;
}

function usePurchaseStatus(reference: string) {
  const queryClient = useQueryClient();
  const queryKey = ['purchase', reference];
  const query = useQuery({
    queryKey,
    queryFn: () => apiFetch<PurchaseStatusDto>(`/checkout/purchases/${encodeURIComponent(reference)}`),
    retry: false,
    staleTime: 0,
    refetchInterval: (current) =>
      current.state.data?.status === 'pending' && attemptsOf(current.state) < MAX_ATTEMPTS ? POLL_INTERVAL_MS : false,
  });
  // Leer estas marcas suscribe el render a cada respuesta o error, aunque `data` sea idéntico (structural sharing);
  // sin eso el último intento no vuelve a renderizar y `attempts` queda viejo.
  void query.dataUpdatedAt;
  void query.errorUpdatedAt;
  return { query, attempts: attemptsOf(queryClient.getQueryState(queryKey)) };
}

function PurchaseStatus({ reference }: { reference: string }) {
  const { query: purchase, attempts } = usePurchaseStatus(reference);

  if (purchase.isPending) return <Skeleton className="h-48 rounded" />;
  // Un error del polling no tapa el último estado conocido: la próxima consulta lo corrige.
  if (purchase.data) return <PaymentResultView status={purchase.data} timedOut={attempts >= MAX_ATTEMPTS} />;
  if (purchase.error instanceof ApiError && purchase.error.code === 'PURCHASE_NOT_FOUND') {
    return <EmptyState title="No encontramos la operación" description="Revisá el link o contactá a MOVE." />;
  }
  return <ErrorState error={purchase.error} onRetry={() => void purchase.refetch()} />;
}

export function PaymentResult() {
  const reference = useSearchParams().get('ref');
  if (!reference) return <EmptyState title="No encontramos la operación" description="Revisá el link o contactá a MOVE." />;
  return <PurchaseStatus reference={reference} />;
}
