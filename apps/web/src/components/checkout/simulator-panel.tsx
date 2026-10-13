'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { EmptyState } from '@/components/move/empty-state';
import { moveButtonSize } from '@/components/move/button-styles';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type { PurchaseStatusDto } from '@/lib/api/types';

type Outcome = 'approved' | 'rejected';

const BUTTON_CLASS = moveButtonSize({ size: 'cta', className: 'flex-1' });

function isSimulatorDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'NOT_FOUND';
}

export function SimulatorPanel() {
  const router = useRouter();
  const reference = useSearchParams().get('ref');
  const simulate = useMutation({
    mutationFn: (outcome: Outcome) =>
      apiFetch<PurchaseStatusDto>('/payments/dev/simulate', {
        method: 'POST',
        body: { externalReference: reference, outcome },
      }),
    onSuccess: () => router.replace(`/checkout/resultado?ref=${encodeURIComponent(reference ?? '')}`),
  });

  if (!reference) return <EmptyState title="No encontramos la operación" description="Falta la referencia del pago." />;
  if (isSimulatorDisabled(simulate.error)) return <EmptyState title="Simulador desactivado" />;

  return (
    <div className="rounded border border-border bg-card p-7">
      <p className="font-display text-2xl font-black uppercase tracking-tight">Simulador de pagos (desarrollo)</p>
      <p className="mt-3 text-sm text-muted-foreground">Elegí el resultado del pago para continuar el flujo sin Mercado Pago.</p>
      {simulate.isError ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {errorMessage(simulate.error)}
        </p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <Button disabled={simulate.isPending} onClick={() => simulate.mutate('approved')} className={BUTTON_CLASS}>
          Aprobar
        </Button>
        <Button variant="outline" disabled={simulate.isPending} onClick={() => simulate.mutate('rejected')} className={BUTTON_CLASS}>
          Rechazar
        </Button>
      </div>
    </div>
  );
}
