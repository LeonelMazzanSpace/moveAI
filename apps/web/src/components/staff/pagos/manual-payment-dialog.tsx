'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ErrorState } from '@/components/move/error-state';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, FormField, SELECT_CLASS } from '@/components/staff/config/plan-form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { ClientRowDto, PlanDto, StaffPaymentDto } from '@/lib/api/types';
import { formatUYU, SERVICE_LABEL } from '@/lib/format';
import { ClientPicker } from './client-picker';
import {
  EMPTY_MANUAL_PAYMENT,
  isPayablePlan,
  MANUAL_METHODS,
  MANUAL_METHOD_LABEL,
  manualPaymentSchema,
  type ManualPaymentInput,
  type ManualPaymentPayload,
} from './manual-payment.schema';

const PAYMENTS_KEY = ['staff', 'payments'] as const;
const PAYABLE_PLANS_KEY = ['staff', 'plans', 'payable'] as const;

interface ManualPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ManualPaymentFormProps {
  onDone: () => void;
}

function ManualPaymentForm({ onDone }: ManualPaymentFormProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const queryClient = useQueryClient();
  const [client, setClient] = useState<Pick<ClientRowDto, 'id' | 'name' | 'email'> | null>(null);
  const plansQuery = useQuery({
    queryKey: PAYABLE_PLANS_KEY,
    queryFn: () => apiFetch<PlanDto[]>('/staff/plans'),
  });
  const { register, handleSubmit, setValue, control, formState } = useForm<ManualPaymentInput, unknown, ManualPaymentPayload>({
    resolver: zodResolver(manualPaymentSchema),
    defaultValues: EMPTY_MANUAL_PAYMENT,
  });
  const { errors } = formState;

  const record = useMutation({
    mutationFn: (body: ManualPaymentPayload) => apiFetch<StaffPaymentDto>('/staff/payments/manual', { method: 'POST', body }),
    onSuccess: async () => {
      toast.success('Pago registrado');
      onDone();
      await queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY });
    },
  });

  const plans = (plansQuery.data ?? []).filter(isPayablePlan);
  if (plansQuery.error) return <ErrorState error={plansQuery.error} onRetry={() => void plansQuery.refetch()} />;

  const planField = register('planId', {
    onChange: (event) => {
      const plan = plans.find((candidate) => candidate.id === event.target.value);
      if (plan) setValue('amount', String(plan.price), { shouldValidate: formState.isSubmitted });
    },
  });

  return (
    <form onSubmit={handleSubmit((payload) => record.mutate(payload))} noValidate className="space-y-4">
      <FormField id={id('client')} label="Cliente" error={errors.clientId?.message}>
        <Controller
          control={control}
          name="clientId"
          render={({ field }) => (
            <ClientPicker
              id={id('client')}
              selected={client}
              invalid={Boolean(errors.clientId)}
              onSelect={(picked) => {
                setClient(picked);
                field.onChange(picked?.id ?? '');
              }}
            />
          )}
        />
      </FormField>
      <FormField id={id('plan')} label="Plan" error={errors.planId?.message}>
        <select id={id('plan')} className={SELECT_CLASS} {...planField}>
          <option value="">Elegí un plan</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {SERVICE_LABEL[plan.service]} · {plan.name} · {formatUYU(plan.price)}
            </option>
          ))}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id={id('method')} label="Método" error={errors.method?.message}>
          <select id={id('method')} className={SELECT_CLASS} {...register('method')}>
            {MANUAL_METHODS.map((method) => (
              <option key={method} value={method}>
                {MANUAL_METHOD_LABEL[method]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={id('amount')} label="Monto (UYU)" error={errors.amount?.message}>
          <Input id={id('amount')} type="number" inputMode="decimal" min={0} {...register('amount')} />
        </FormField>
      </div>
      <FormField id={id('note')} label="Nota (opcional)" error={errors.note?.message}>
        <Textarea id={id('note')} rows={2} {...register('note')} />
      </FormField>
      {record.error ? (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(record.error)}
        </p>
      ) : null}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className={BUTTON_OUTLINE} onClick={onDone}>
          Cancelar
        </button>
        <button type="submit" className={BUTTON_PRIMARY} disabled={record.isPending}>
          Registrar pago
        </button>
      </div>
    </form>
  );
}

export function ManualPaymentDialog({ open, onOpenChange }: ManualPaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pago manual</DialogTitle>
          <DialogDescription>El pago activa el plan del cliente de inmediato.</DialogDescription>
        </DialogHeader>
        <ManualPaymentForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
