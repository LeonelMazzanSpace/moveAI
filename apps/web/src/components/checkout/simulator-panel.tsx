'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { EmptyState } from '@/components/move/empty-state';
import { moveButtonSize } from '@/components/move/button-styles';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type { AutoDebitStatus, AutoDebitStatusDto, PurchaseStatusDto } from '@/lib/api/types';

type Outcome = 'approved' | 'rejected';
type DebitAction = 'authorize' | 'charge_approved' | 'charge_rejected' | 'cancel';

const BUTTON_CLASS = moveButtonSize({ size: 'cta', className: 'flex-1' });

const DEBIT_ACTIONS: { action: DebitAction; label: string; variant: 'default' | 'outline' }[] = [
  { action: 'authorize', label: 'Autorizar', variant: 'default' },
  { action: 'charge_approved', label: 'Cobrar ciclo (aprobado)', variant: 'outline' },
  { action: 'charge_rejected', label: 'Cobrar ciclo (rechazado)', variant: 'outline' },
  { action: 'cancel', label: 'Cancelar', variant: 'outline' },
];

const DEBIT_STATUS_LABEL: Record<AutoDebitStatus, string> = {
  pending: 'pendiente de autorización',
  authorized: 'activo',
  cancelled: 'cancelado',
};

function isSimulatorDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'NOT_FOUND';
}

function PurchaseSimulator({ reference }: { reference: string }) {
  const router = useRouter();
  const simulate = useMutation({
    mutationFn: (outcome: Outcome) =>
      apiFetch<PurchaseStatusDto>('/payments/dev/simulate', {
        method: 'POST',
        body: { externalReference: reference, outcome },
      }),
    onSuccess: () => router.replace(`/checkout/resultado?ref=${encodeURIComponent(reference)}`),
  });

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

function AutoDebitSimulator({ reference }: { reference: string }) {
  const router = useRouter();
  const simulate = useMutation({
    mutationFn: (action: DebitAction) =>
      apiFetch<AutoDebitStatusDto>('/payments/dev/simulate-auto-debit', {
        method: 'POST',
        body: { externalReference: reference, action },
      }),
    onSuccess: (_status, action) => {
      if (action === 'authorize') router.replace(`/checkout/resultado?debito=${encodeURIComponent(reference)}`);
    },
  });

  if (isSimulatorDisabled(simulate.error)) return <EmptyState title="Simulador desactivado" />;

  return (
    <div className="rounded border border-border bg-card p-7">
      <p className="font-display text-2xl font-black uppercase tracking-tight">Simulador de débito automático (desarrollo)</p>
      <p className="mt-3 text-sm text-muted-foreground">Autorizá el débito y simulá cobros o la cancelación sin Mercado Pago.</p>
      {simulate.isError ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {errorMessage(simulate.error)}
        </p>
      ) : null}
      {simulate.data ? (
        <p role="status" className="mt-4 text-sm font-medium">
          {`Estado del débito: ${DEBIT_STATUS_LABEL[simulate.data.status]}`}
        </p>
      ) : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {DEBIT_ACTIONS.map(({ action, label, variant }) => (
          <Button key={action} variant={variant} disabled={simulate.isPending} onClick={() => simulate.mutate(action)} className={BUTTON_CLASS}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function SimulatorPanel() {
  const params = useSearchParams();
  const debit = params.get('debito');
  const reference = params.get('ref');

  if (debit) return <AutoDebitSimulator reference={debit} />;
  if (!reference) return <EmptyState title="No encontramos la operación" description="Falta la referencia del pago." />;
  return <PurchaseSimulator reference={reference} />;
}
