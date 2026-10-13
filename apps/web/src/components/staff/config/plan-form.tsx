'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useId, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PlanDto, Service } from '@/lib/api/types';
import { SERVICE_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  emptyPlanFormValues,
  KIND_FIELDS,
  KIND_LABEL,
  KINDS_BY_SERVICE,
  planFormSchema,
  planToFormValues,
  SERVICES,
  type PlanFormInput,
  type PlanFormPayload,
} from './plan-form.schema';

const BUTTON_BASE = 'rounded px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] disabled:opacity-50';
export const BUTTON_PRIMARY = cn(BUTTON_BASE, 'bg-primary text-primary-foreground hover:bg-primary/80');
export const BUTTON_OUTLINE = cn(BUTTON_BASE, 'border border-border text-foreground hover:bg-card');
export const BUTTON_DANGER = cn(BUTTON_BASE, 'border border-border text-danger hover:bg-danger-muted');
export const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';
export const CHECKBOX_CLASS = 'size-4 accent-primary';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}

export function FormField({ id, label, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface PlanFormProps {
  mode: 'create' | 'edit';
  plan?: PlanDto;
  submitting?: boolean;
  onSubmit: (payload: PlanFormPayload) => void | Promise<void>;
  onCancel?: () => void;
}

export function PlanForm({ mode, plan, submitting = false, onSubmit, onCancel }: PlanFormProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const editing = mode === 'edit';
  const { register, handleSubmit, setValue, control, formState } = useForm<PlanFormInput, unknown, PlanFormPayload>({
    resolver: zodResolver(planFormSchema),
    defaultValues: plan ? planToFormValues(plan) : emptyPlanFormValues(),
  });
  const { errors } = formState;
  const service = useWatch({ control, name: 'service' });
  const kind = useWatch({ control, name: 'kind' });
  const usage = KIND_FIELDS[kind];

  const serviceField = register('service', {
    onChange: (event) => setValue('kind', KINDS_BY_SERVICE[event.target.value as Service][0], { shouldValidate: formState.isSubmitted }),
  });

  return (
    <form onSubmit={handleSubmit((payload) => onSubmit(payload))} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField id={id('service')} label="Servicio" error={errors.service?.message}>
          <select id={id('service')} className={SELECT_CLASS} disabled={editing} {...serviceField}>
            {SERVICES.map((value) => (
              <option key={value} value={value}>
                {SERVICE_LABEL[value]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={id('kind')} label="Tipo" error={errors.kind?.message}>
          <select id={id('kind')} className={SELECT_CLASS} disabled={editing} {...register('kind')}>
            {KINDS_BY_SERVICE[service].map((value) => (
              <option key={value} value={value}>
                {KIND_LABEL[value]}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField id={id('name')} label="Nombre" error={errors.name?.message}>
        <Input id={id('name')} {...register('name')} />
      </FormField>
      <FormField id={id('slug')} label="Identificador" error={errors.slug?.message}>
        <Input id={id('slug')} autoComplete="off" {...register('slug')} />
      </FormField>
      <FormField id={id('description')} label="Descripción" error={errors.description?.message}>
        <Textarea id={id('description')} rows={2} {...register('description')} />
      </FormField>
      <FormField id={id('features')} label="Características (una por línea)" error={errors.features?.message}>
        <Textarea id={id('features')} rows={3} {...register('features')} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id={id('price')} label="Precio (UYU)" error={errors.price?.message}>
          <Input id={id('price')} type="number" inputMode="numeric" {...register('price')} />
        </FormField>
        {usage.periodMonths !== 'hidden' ? (
          <FormField id={id('periodMonths')} label="Meses" error={errors.periodMonths?.message}>
            <Input id={id('periodMonths')} type="number" inputMode="numeric" {...register('periodMonths')} />
          </FormField>
        ) : null}
        {usage.periodDays !== 'hidden' ? (
          <FormField id={id('periodDays')} label="Días de vigencia" error={errors.periodDays?.message}>
            <Input id={id('periodDays')} type="number" inputMode="numeric" {...register('periodDays')} />
          </FormField>
        ) : null}
        {usage.sessionsIncluded !== 'hidden' ? (
          <FormField id={id('sessionsIncluded')} label="Sesiones incluidas" error={errors.sessionsIncluded?.message}>
            <Input id={id('sessionsIncluded')} type="number" inputMode="numeric" {...register('sessionsIncluded')} />
          </FormField>
        ) : null}
        {usage.durationMinutes !== 'hidden' ? (
          <FormField id={id('durationMinutes')} label="Duración (min)" error={errors.durationMinutes?.message}>
            <Input id={id('durationMinutes')} type="number" inputMode="numeric" {...register('durationMinutes')} />
          </FormField>
        ) : null}
        <FormField id={id('sortOrder')} label="Orden" error={errors.sortOrder?.message}>
          <Input id={id('sortOrder')} type="number" inputMode="numeric" {...register('sortOrder')} />
        </FormField>
      </div>
      <div className="flex gap-6">
        <Label htmlFor={id('featured')} className="text-sm">
          <input id={id('featured')} type="checkbox" className={CHECKBOX_CLASS} {...register('featured')} />
          Destacado
        </Label>
        <Label htmlFor={id('active')} className="text-sm">
          <input id={id('active')} type="checkbox" className={CHECKBOX_CLASS} {...register('active')} />
          Activo
        </Label>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        {onCancel ? (
          <button type="button" className={BUTTON_OUTLINE} onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" className={BUTTON_PRIMARY} disabled={submitting}>
          Guardar
        </button>
      </div>
    </form>
  );
}
