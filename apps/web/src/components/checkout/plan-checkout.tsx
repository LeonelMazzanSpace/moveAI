'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, useState } from 'react';
import { frequencyLabel, useMyAutoDebits } from '@/components/client/use-auto-debits';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { moveButtonSize } from '@/components/move/button-styles';
import { RADIO_CLASS } from '@/components/move/radio-styles';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type { AutoDebitDto, MySubscriptionsDto, PlanDto } from '@/lib/api/types';
import { addDaysWeb, formatDate, formatUYU, SERVICE_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAutoDebitCheckout, usePlanCheckout } from './use-checkout';

const HIDDEN_TEXT = /prioridad de horarios/i;

type PaymentMode = 'one_time' | 'auto_debit';

function validity(plan: PlanDto): string | null {
  if (plan.periodMonths) return plan.periodMonths === 1 ? '1 mes' : `${plan.periodMonths} meses`;
  if (plan.periodDays) return `${plan.periodDays} días`;
  return null;
}

function summaryRows(plan: PlanDto): [string, string][] {
  const rows: [string, string][] = [];
  if (plan.sessionsIncluded) rows.push(['Sesiones', String(plan.sessionsIncluded)]);
  const period = validity(plan);
  if (period) rows.push([plan.kind === 'session_pack' ? 'Vigencia del paquete' : 'Período', period]);
  return rows;
}

/** Inicio del nuevo período si ya tiene un plan Performance vigente o programado. */
function renewalStart(plan: PlanDto, subscriptions: MySubscriptionsDto | undefined): string | null {
  if (plan.kind !== 'period_plan') return null;
  const current = subscriptions?.upcomingPerformance ?? subscriptions?.performance;
  if (!current || current.status === 'expired') return null;
  return addDaysWeb(current.endsOn, 1);
}

function PlanSummary({ plan, startsOn }: { plan: PlanDto; startsOn: string | null }) {
  const features = plan.features.filter((feature) => !HIDDEN_TEXT.test(feature));

  return (
    <div className="rounded border border-border bg-card p-7">
      <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{plan.name}</p>
      <p className="mt-3 font-display text-4xl font-black">
        <span>{formatUYU(plan.price)}</span>
        {plan.kind === 'session_pack' ? <span className="text-sm font-semibold text-muted-foreground"> /paquete</span> : null}
      </p>
      <dl className="mt-5 space-y-3 text-sm">
        {summaryRows(plan).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {plan.kind === 'session_pack' ? (
        <p className="mt-4 text-sm text-muted-foreground">Las sesiones no usadas vencen al final del período.</p>
      ) : null}
      {features.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      ) : null}
      {startsOn ? (
        <p className="mt-5 border-t border-border pt-5 text-sm font-medium">Tu nuevo período empieza el {formatDate(startsOn)}</p>
      ) : null}
    </div>
  );
}

/** Cada cuánto se cobra el débito: los planes por período cada `periodMonths` meses y los paquetes cada `periodDays` días. */
function chargeFrequency(plan: PlanDto): string | null {
  if (plan.kind === 'period_plan' && plan.periodMonths) return frequencyLabel(plan.periodMonths, 'months');
  if (plan.kind === 'session_pack' && plan.periodDays) return frequencyLabel(plan.periodDays, 'days');
  return null;
}

function PaymentModeOption({
  name,
  value,
  checked,
  onSelect,
  label,
  children,
}: {
  name: string;
  value: PaymentMode;
  checked: boolean;
  onSelect: (mode: PaymentMode) => void;
  label: string;
  children?: React.ReactNode;
}) {
  const id = `${name}-${value}`;
  const labelId = `${id}-label`;
  const descriptionId = children ? `${id}-description` : undefined;
  // The label covers the whole card so a click anywhere chooses the option; the name comes from the label text only.
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3 rounded border bg-card p-4', checked ? 'border-foreground' : 'border-border')}>
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        className={cn(RADIO_CLASS, 'mt-2')}
      />
      <div className="space-y-1.5">
        <span id={labelId} className="flex min-h-8 items-center text-sm font-medium">
          {label}
        </span>
        {children ? (
          <div id={descriptionId} className="space-y-1.5">
            {children}
          </div>
        ) : null}
      </div>
    </label>
  );
}

interface PaymentModeFieldProps {
  plan: PlanDto;
  firstChargeOn: string | null;
  mode: PaymentMode;
  onChange: (mode: PaymentMode) => void;
  /** Con un checkout en curso no se puede cambiar de modo: empezaría un segundo checkout. */
  disabled: boolean;
}

function PaymentModeField({ plan, firstChargeOn, mode, onChange, disabled }: PaymentModeFieldProps) {
  const name = useId();
  const frequency = chargeFrequency(plan);

  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="sr-only">Forma de pago</legend>
      <PaymentModeOption name={name} value="one_time" checked={mode === 'one_time'} onSelect={onChange} label="Pago único" />
      <PaymentModeOption name={name} value="auto_debit" checked={mode === 'auto_debit'} onSelect={onChange} label="Débito automático">
        <p className="text-sm text-muted-foreground">
          {`Se cobra automáticamente ${frequency ?? 'de forma periódica'} con Mercado Pago. Podés cancelarlo cuando quieras desde tu perfil.`}
        </p>
        {firstChargeOn ? (
          <p className="text-sm text-muted-foreground">{`El primer cobro es el ${formatDate(firstChargeOn)}, cuando termina tu plan actual.`}</p>
        ) : null}
      </PaymentModeOption>
    </fieldset>
  );
}

function AutoDebitActiveNotice({ plan }: { plan: PlanDto }) {
  return (
    <p role="status" className="rounded border border-border bg-soft p-4 text-sm">
      {`Ya tenés débito automático activo para ${SERVICE_LABEL[plan.service]}.`}
      {' '}
      <Link href="/perfil" className="font-semibold underline underline-offset-4">
        Gestionarlo en mi perfil
      </Link>
    </p>
  );
}

/** Un plan Performance no se compra mientras haya un débito autorizado de Performance (D97). */
function hasActivePerformanceDebit(plan: PlanDto, debits: AutoDebitDto[] | undefined): boolean {
  if (plan.service !== 'performance') return false;
  return (debits ?? []).some((debit) => debit.service === 'performance' && debit.status === 'authorized');
}

function isAutoDebitActiveError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'AUTO_DEBIT_ACTIVE';
}

function PlanUnavailable() {
  return (
    <EmptyState
      title="Plan no disponible"
      description="Este plan no existe o no se puede contratar online."
      action={
        <Link href="/planes" className="inline-flex min-h-8 items-center text-xs font-semibold underline underline-offset-4">
          Ver planes
        </Link>
      }
    />
  );
}

export function PlanCheckout({ slug }: { slug: string }) {
  const plan = useQuery({
    queryKey: ['catalog', 'plan', slug],
    queryFn: () => apiFetch<PlanDto>(`/catalog/plans/${encodeURIComponent(slug)}`),
    retry: false,
  });
  const subscriptions = useQuery({
    queryKey: ['me', 'subscriptions'],
    queryFn: () => apiFetch<MySubscriptionsDto>('/me/subscriptions'),
  });
  const autoDebitAllowed = plan.data?.autoDebitEnabled === true;
  // Todo plan Performance consulta los débitos: un débito autorizado de Performance bloquea la compra aunque este plan no permita débito.
  const checksDebits = autoDebitAllowed || plan.data?.service === 'performance';
  const debits = useMyAutoDebits({ enabled: checksDebits });
  const checkout = usePlanCheckout();
  const autoDebitCheckout = useAutoDebitCheckout();
  const [mode, setMode] = useState<PaymentMode>('one_time');

  if (plan.isPending) return <Skeleton className="h-64 rounded" />;
  if (plan.error instanceof ApiError && plan.error.code === 'PLAN_NOT_FOUND') return <PlanUnavailable />;
  if (plan.isError) return <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />;
  if (plan.data.kind !== 'period_plan' && plan.data.kind !== 'session_pack') return <PlanUnavailable />;

  const startsOn = renewalStart(plan.data, subscriptions.data);
  const debitMode = autoDebitAllowed && mode === 'auto_debit';
  const mutation = debitMode ? autoDebitCheckout : checkout;
  // Un checkout en curso, o ya enviado a Mercado Pago, bloquea todo: el modo y el botón del otro camino también.
  const checkoutStarted = [checkout, autoDebitCheckout].some((started) => started.isPending || started.isSuccess);
  const blocked =
    hasActivePerformanceDebit(plan.data, debits.data) ||
    (plan.data.service === 'performance' && (isAutoDebitActiveError(checkout.error) || isAutoDebitActiveError(autoDebitCheckout.error)));

  return (
    <div className="space-y-6">
      <PlanSummary plan={plan.data} startsOn={startsOn} />
      {blocked ? (
        <AutoDebitActiveNotice plan={plan.data} />
      ) : (
        <>
          {autoDebitAllowed ? (
            <PaymentModeField plan={plan.data} firstChargeOn={startsOn} mode={mode} onChange={setMode} disabled={checkoutStarted} />
          ) : null}
          {mutation.isError ? (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(mutation.error)}
            </p>
          ) : null}
          <Button
            disabled={checkoutStarted || (plan.data.service === 'performance' && debits.isLoading)}
            onClick={() => (debitMode ? autoDebitCheckout.mutate(plan.data.slug) : checkout.mutate(plan.data.id))}
            className={moveButtonSize({ size: 'block' })}
          >
            {debitMode ? 'Activar débito automático' : 'Pagar con Mercado Pago'}
          </Button>
        </>
      )}
    </div>
  );
}
