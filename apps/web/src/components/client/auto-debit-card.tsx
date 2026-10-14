'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AutoDebitDto } from '@/lib/api/types';
import { formatDate, formatDayMonth } from '@/lib/format';
import { cancelErrorMessage, isActiveAutoDebit, useCancelAutoDebit, useMyAutoDebits } from './use-auto-debits';

interface CancelAutoDebitDialogProps {
  open: boolean;
  description: string;
  pending: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmación de "Cancelar débito", compartida con el detalle de cliente del staff. */
export function CancelAutoDebitDialog({ open, description, pending, error, onConfirm, onClose }: CancelAutoDebitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>¿Cancelar el débito automático?</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {cancelErrorMessage(error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Volver
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            Sí, cancelar débito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function statusLabel({ status, nextChargeDate }: AutoDebitDto): string {
  if (status === 'pending') return 'Débito automático pendiente de autorización';
  return nextChargeDate ? `Débito automático activo · próximo cobro ${formatDayMonth(nextChargeDate)}` : 'Débito automático activo';
}

interface AutoDebitCardProps {
  service: AutoDebitDto['service'];
  /** Último día cubierto por lo ya pagado, o `null` si no hay un plan o paquete vigente. */
  endsOn: string | null;
}

/** Débito automático vigente del cliente para un servicio, con su cancelación; no muestra nada si no hay. */
export function AutoDebitCard({ service, endsOn }: AutoDebitCardProps) {
  const debits = useMyAutoDebits();
  const cancel = useCancelAutoDebit();
  const [confirming, setConfirming] = useState(false);
  const debit = debits.data?.find((candidate) => candidate.service === service && isActiveAutoDebit(candidate));
  if (!debit) return null;

  const close = () => {
    setConfirming(false);
    cancel.reset();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-soft px-4 py-3">
      <p className="text-sm font-medium">{statusLabel(debit)}</p>
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Cancelar débito
      </Button>
      <CancelAutoDebitDialog
        open={confirming}
        description={endsOn ? `Lo que ya pagaste sigue vigente hasta el ${formatDate(endsOn)}.` : 'Lo que ya pagaste sigue vigente.'}
        pending={cancel.isPending}
        error={cancel.error}
        onConfirm={() => cancel.mutate(debit.id, { onSuccess: close })}
        onClose={close}
      />
    </div>
  );
}
