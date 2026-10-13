'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useBookSlot } from '@/components/booking/use-book-slot';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { PlanCard } from '@/components/move/plan-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { MySubscriptionsDto, PackDto, PlanDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { SlotPicker } from './booking-summary';
import { PaidBookingFlow } from './rehab-booking-flow';
import { useMe, useSlotPicker } from './use-checkout';

const RECOVERY_STEPS = ['Selección', 'Reserva', 'Pago', 'Confirmación'] as const;
const BUTTON_CLASS = 'h-auto px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em]';

function sessionsLeftLabel(count: number): string {
  return count === 1 ? 'Te queda 1 sesión' : `Te quedan ${count} sesiones`;
}

function PackBooking({ pack }: { pack: PackDto }) {
  const queryClient = useQueryClient();
  const picker = useSlotPicker('recovery');
  const { book, pendingSlotId } = useBookSlot();

  function reserve() {
    if (!picker.slotId) return;
    book(picker.slotId, {
      onSuccess: () => {
        picker.refresh();
        void queryClient.invalidateQueries({ queryKey: ['me', 'subscriptions'] });
      },
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="font-display text-2xl font-black uppercase tracking-tight">{sessionsLeftLabel(pack.sessionsLeft)}</p>
        <p className="mt-2 text-sm text-muted-foreground">{pack.planName}: elegí fecha y horario para tu próxima sesión.</p>
      </div>
      <SlotPicker picker={picker} />
      <Button disabled={picker.slotId === null || pendingSlotId !== null} onClick={reserve} className={BUTTON_CLASS}>
        Reservar
      </Button>
    </div>
  );
}

type Mode = 'single' | 'pack';

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded border px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.2em]',
        active ? 'border-transparent bg-primary text-primary-foreground' : 'border-border hover:bg-soft',
      )}
    >
      {children}
    </button>
  );
}

function ModeChooser({ plans }: { plans: PlanDto[] }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const single = plans.find((plan) => plan.kind === 'single_session');
  const packs = plans.filter((plan) => plan.kind === 'session_pack');

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <ModeButton active={mode === 'single'} onClick={() => setMode('single')}>
          Sesión individual
        </ModeButton>
        <ModeButton active={mode === 'pack'} onClick={() => setMode('pack')}>
          Paquete
        </ModeButton>
      </div>
      {mode === 'single' && single ? <PaidBookingFlow plan={single} nextPath="/recovery" steps={RECOVERY_STEPS} /> : null}
      {mode === 'single' && !single ? <EmptyState title="Sesión individual no disponible por el momento" /> : null}
      {mode === 'pack' ? (
        <div className="grid gap-6 md:grid-cols-3">
          {packs.map((plan) => (
            <PlanCard key={plan.id} plan={plan} ctaHref={`/checkout/plan/${plan.slug}`} ctaLabel="Contratar paquete" unitLabel="/paquete" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function activePack(subscriptions: MySubscriptionsDto | undefined): PackDto | undefined {
  return subscriptions?.recoveryPacks.find((pack) => pack.sessionsLeft > 0);
}

/**
 * `true` desde la primera vez que `resolved` fue `true`. El flujo de pago vuelve a consultar `/me`
 * al montarse y, si la consulta había fallado (visitante), la deja en `pending` otra vez.
 */
function useSettled(resolved: boolean): boolean {
  const [settled, setSettled] = useState(resolved);
  if (resolved && !settled) setSettled(true);
  return settled || resolved;
}

export function RecoveryBookingFlow({ plans }: { plans: PlanDto[] }) {
  const { me, isGuest, error: meError, refetch: refetchMe } = useMe();
  const meSettled = useSettled(me !== null || isGuest);
  const subscriptions = useQuery({
    queryKey: ['me', 'subscriptions'],
    queryFn: () => apiFetch<MySubscriptionsDto>('/me/subscriptions'),
    enabled: me !== null,
  });

  const pack = activePack(subscriptions.data);
  const loading = !meSettled || (me !== null && subscriptions.isPending);

  return (
    <div>
      <h2 className="font-display text-3xl font-black uppercase tracking-tight">Reservá tu sesión.</h2>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Sesión individual o paquete mensual. Los paquetes duran 30 días desde la compra y las sesiones no usadas vencen al final.
      </p>
      <div className="mt-10">
        {meError ? <ErrorState error={meError} onRetry={() => void refetchMe()} /> : null}
        {!meError && loading ? <Skeleton className="h-64 rounded" /> : null}
        {!meError && !loading && subscriptions.isError ? (
          <ErrorState error={subscriptions.error} onRetry={() => void subscriptions.refetch()} />
        ) : null}
        {!meError && !loading && !subscriptions.isError && pack ? <PackBooking pack={pack} /> : null}
        {!meError && !loading && !subscriptions.isError && !pack ? <ModeChooser plans={plans} /> : null}
      </div>
    </div>
  );
}
