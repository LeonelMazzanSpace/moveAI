'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/move/empty-state';
import { moveButton, moveButtonSize } from '@/components/move/button-styles';
import { ErrorState } from '@/components/move/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type { PlanDto } from '@/lib/api/types';
import { withNext } from '@/lib/auth/post-login';
import { BookingSummary, SlotPicker } from './booking-summary';
import { GuestForm } from './guest-form';
import type { GuestValues } from './guest-form.schema';
import { Stepper } from './stepper';
import { useBookingCheckout, useMe, useSlotPicker } from './use-checkout';

const REFRESH_CODES: ApiError['code'][] = ['SLOT_FULL', 'SLOT_NOT_BOOKABLE'];
const PAY_STEP = 3;
const PICK_STEP = 2;

function isError(error: unknown, code: ApiError['code']): boolean {
  return error instanceof ApiError && error.code === code;
}

interface PaidBookingFlowProps {
  plan: PlanDto;
  nextPath: string;
  steps: readonly string[];
}

/** Elegir turno y pagarlo con Mercado Pago, con sesión o como invitado. */
export function PaidBookingFlow({ plan, nextPath, steps }: PaidBookingFlowProps) {
  const picker = useSlotPicker(plan.service);
  const { me, isPending: mePending, error: meError, refetch: refetchMe } = useMe();
  const checkout = useBookingCheckout();
  const [showGuest, setShowGuest] = useState(false);
  // El formulario de invitado sigue montado aunque el turno se haya liberado, para no perder lo escrito.
  const needsGuest = me === null && showGuest;
  const hasSlot = picker.slotId !== null;

  function pay(guest?: GuestValues) {
    if (!picker.slotId) return;
    checkout.mutate(
      { planId: plan.id, timeSlotId: picker.slotId, ...(guest ? { guest } : {}) },
      { onError: (error) => REFRESH_CODES.some((code) => isError(error, code)) && picker.refresh() },
    );
  }

  function continueToPayment() {
    if (me) return pay();
    setShowGuest(true);
  }

  const paying = (needsGuest && hasSlot) || checkout.isPending || checkout.isSuccess;

  if (meError) return <ErrorState error={meError} onRetry={() => void refetchMe()} />;

  return (
    <div className="space-y-8">
      <Stepper steps={steps} current={paying ? PAY_STEP : PICK_STEP} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          <SlotPicker picker={picker} />
          {needsGuest ? (
            <div className="rounded border border-border bg-card p-7">
              <p className="mb-5 text-sm text-muted-foreground">
                Dejanos tus datos para crear tu cuenta y confirmar la reserva.
              </p>
              {hasSlot ? null : <p className="mb-5 text-sm text-danger">Elegí otro horario para continuar.</p>}
              <GuestForm
                onSubmit={pay}
                isSubmitting={checkout.isPending || checkout.isSuccess || !hasSlot}
                submitLabel="Ir a pagar"
              />
            </div>
          ) : null}
        </div>
        <div className="space-y-5">
          <BookingSummary plan={plan} slot={picker.slot} />
          {checkout.isError ? (
            <div role="alert" className="space-y-3 text-sm text-danger">
              <p>{errorMessage(checkout.error)}</p>
              {isError(checkout.error, 'LOGIN_REQUIRED') ? (
                <Link href={withNext('/ingresar', nextPath)} className={moveButton({ size: 'cta' })}>
                  Ingresar
                </Link>
              ) : null}
            </div>
          ) : null}
          {needsGuest ? null : (
            <Button
              disabled={picker.slotId === null || mePending || checkout.isPending || checkout.isSuccess}
              onClick={continueToPayment}
              className={moveButtonSize({ size: 'block' })}
            >
              Continuar al pago
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const REHAB_STEPS = ['Evaluación', 'Fecha y horario', 'Pago', 'Confirmación'] as const;

export function RehabBookingFlow({ plan }: { plan: PlanDto | null }) {
  return (
    <div>
      <h2 className="font-display text-3xl font-black uppercase tracking-tight">Reservá tu evaluación.</h2>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Elegí fecha y horario con el profesional. El tratamiento posterior lo define el equipo de MOVE después de la evaluación.
      </p>
      <div className="mt-10">
        {plan ? (
          <PaidBookingFlow plan={plan} nextPath="/rehab" steps={REHAB_STEPS} />
        ) : (
          <EmptyState title="Reservas no disponibles por el momento" description="Volvé a intentar en unos minutos." />
        )}
      </div>
    </div>
  );
}

export function RehabBookingSkeleton() {
  return <Skeleton className="h-96 rounded" />;
}
