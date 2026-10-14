'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { moveButton } from '@/components/move/button-styles';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { AutoDebitStatusDto } from '@/lib/api/types';
import { formatDate, formatUYU } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MAX_POLL_ATTEMPTS, usePolledStatus } from './use-checkout';

const CTA_CLASS = moveButton({ size: 'cta' });
const SECONDARY_CTA_CLASS = moveButton({ variant: 'outline', size: 'cta' });

function ResultCard({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-card p-7">
      <p className="font-display text-2xl font-black uppercase tracking-tight">{title}</p>
      {children}
    </div>
  );
}

function RetryLink({ planSlug }: { planSlug: string }) {
  return (
    <Link href={`/checkout/plan/${planSlug}`} className={cn(SECONDARY_CTA_CLASS, 'mt-6')}>
      Intentar de nuevo
    </Link>
  );
}

function ActiveDetail({ status }: { status: AutoDebitStatusDto }) {
  return (
    <dl className="mt-5 space-y-3 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Plan</dt>
        <dd className="text-right font-medium">{status.planName}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Monto de cada cobro</dt>
        <dd className="text-right font-medium">{formatUYU(status.amount)}</dd>
      </div>
      {status.nextChargeDate ? (
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Próximo cobro</dt>
          <dd className="text-right font-medium">{formatDate(status.nextChargeDate)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

interface AutoDebitResultViewProps {
  status: AutoDebitStatusDto;
  timedOut: boolean;
}

export function AutoDebitResultView({ status, timedOut }: AutoDebitResultViewProps) {
  if (status.status === 'authorized') {
    return (
      <ResultCard title="Débito automático activo">
        <ActiveDetail status={status} />
        <Link href="/perfil" className={cn(CTA_CLASS, 'mt-6')}>
          Ir a mi perfil
        </Link>
      </ResultCard>
    );
  }

  if (status.status === 'pending') {
    return (
      <ResultCard title={timedOut ? 'Débito en proceso' : 'Confirmando tu débito'}>
        <p className="mt-3 text-sm text-muted-foreground">
          {timedOut
            ? 'Todavía no recibimos la autorización de Mercado Pago. Si ya la completaste, puede tardar unos minutos: lo vas a ver en tu perfil. Si no completaste la autorización, podés intentarlo de nuevo.'
            : 'Estamos esperando la confirmación de Mercado Pago. No cierres esta página.'}
        </p>
        {timedOut ? <RetryLink planSlug={status.planSlug} /> : null}
      </ResultCard>
    );
  }

  return (
    <ResultCard title="Débito no activado">
      <p className="mt-3 text-sm text-muted-foreground">El débito automático no se activó o fue cancelado.</p>
      <RetryLink planSlug={status.planSlug} />
    </ResultCard>
  );
}

function useAutoDebitStatus(reference: string) {
  return usePolledStatus({
    queryKey: ['auto-debit', reference],
    queryFn: () => apiFetch<AutoDebitStatusDto>(`/checkout/auto-debits/${encodeURIComponent(reference)}`),
    isPending: (debit) => debit.status === 'pending',
  });
}

export function AutoDebitResult({ reference }: { reference: string }) {
  const { query: debit, attempts } = useAutoDebitStatus(reference);

  if (debit.isPending) return <Skeleton className="h-48 rounded" />;
  // Un error del polling no tapa el último estado conocido: la próxima consulta lo corrige.
  if (debit.data) return <AutoDebitResultView status={debit.data} timedOut={attempts >= MAX_POLL_ATTEMPTS} />;
  if (debit.error instanceof ApiError && debit.error.code === 'AUTO_DEBIT_NOT_FOUND') {
    return <EmptyState title="No encontramos el débito" description="Revisá el link o contactá a MOVE." />;
  }
  return <ErrorState error={debit.error} onRetry={() => void debit.refetch()} />;
}
