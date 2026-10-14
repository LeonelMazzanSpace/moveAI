'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { EmptyState } from '@/components/move/empty-state';
import { moveButton } from '@/components/move/button-styles';
import { ErrorState } from '@/components/move/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { PurchaseStatusDto } from '@/lib/api/types';
import { formatDateLong, formatTime, formatUYU } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AutoDebitResult } from './auto-debit-result';
import { MAX_POLL_ATTEMPTS, usePolledStatus } from './use-checkout';

const CTA_CLASS = moveButton({ size: 'cta' });
const SECONDARY_CTA_CLASS = moveButton({ variant: 'outline', size: 'cta' });

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

function usePurchaseStatus(reference: string) {
  return usePolledStatus({
    queryKey: ['purchase', reference],
    queryFn: () => apiFetch<PurchaseStatusDto>(`/checkout/purchases/${encodeURIComponent(reference)}`),
    isPending: (purchase) => purchase.status === 'pending',
  });
}

function PurchaseStatus({ reference }: { reference: string }) {
  const { query: purchase, attempts } = usePurchaseStatus(reference);

  if (purchase.isPending) return <Skeleton className="h-48 rounded" />;
  // Un error del polling no tapa el último estado conocido: la próxima consulta lo corrige.
  if (purchase.data) return <PaymentResultView status={purchase.data} timedOut={attempts >= MAX_POLL_ATTEMPTS} />;
  if (purchase.error instanceof ApiError && purchase.error.code === 'PURCHASE_NOT_FOUND') {
    return <EmptyState title="No encontramos la operación" description="Revisá el link o contactá a MOVE." />;
  }
  return <ErrorState error={purchase.error} onRetry={() => void purchase.refetch()} />;
}

function ResultContent() {
  const params = useSearchParams();
  const debit = params.get('debito');
  if (debit) return <AutoDebitResult reference={debit} />;
  const reference = params.get('ref');
  if (!reference) return <EmptyState title="No encontramos la operación" description="Revisá el link o contactá a MOVE." />;
  return <PurchaseStatus reference={reference} />;
}

/** La región vive desde el primer render: así los lectores de pantalla anuncian el cambio de pendiente a aprobado, activo o cancelado. */
export function PaymentResult() {
  return (
    <div role="status" aria-live="polite">
      <ResultContent />
    </div>
  );
}
