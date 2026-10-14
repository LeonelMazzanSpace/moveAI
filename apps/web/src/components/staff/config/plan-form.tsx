'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, CHECKBOX_CLASS, FormField, fieldA11y, MAX_MONEY_AMOUNT, SELECT_CLASS } from '@/components/staff/form-primitives';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { applyFieldErrors } from '@/lib/api/field-errors';
import type { PlanDto, Service } from '@/lib/api/types';
import { SERVICE_LABEL } from '@/lib/format';
import {
  AUTO_DEBIT_KINDS,
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

const PLAN_FIELDS: readonly (keyof PlanFormInput)[] = [
  'service',
  'kind',
  'name',
  'slug',
  'description',
  'features',
  'price',
  'periodMonths',
  'periodDays',
  'sessionsIncluded',
  'durationMinutes',
  'sortOrder',
  'featured',
  'active',
  'autoDebitEnabled',
];

interface PlanFormProps {
  mode: 'create' | 'edit';
  plan?: PlanDto;
  submitting?: boolean;
  /** May reject: an API validation failure is shown on the fields, other errors are the caller's to report. */
  onSubmit: (payload: PlanFormPayload) => unknown;
  onCancel?: () => void;
}

export function PlanForm({ mode, plan, submitting = false, onSubmit, onCancel }: PlanFormProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const editing = mode === 'edit';
  const { register, handleSubmit, setValue, setError, control, formState } = useForm<PlanFormInput, unknown, PlanFormPayload>({
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

  async function submit(payload: PlanFormPayload) {
    try {
      await onSubmit(payload);
    } catch (error) {
      applyFieldErrors(error, PLAN_FIELDS, setError);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField id={id('service')} label="Servicio" error={errors.service?.message}>
          <select id={id('service')} className={SELECT_CLASS} disabled={editing} {...fieldA11y(id('service'), errors.service?.message)} {...serviceField}>
            {SERVICES.map((value) => (
              <option key={value} value={value}>
                {SERVICE_LABEL[value]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={id('kind')} label="Tipo" error={errors.kind?.message}>
          <select id={id('kind')} className={SELECT_CLASS} disabled={editing} {...fieldA11y(id('kind'), errors.kind?.message)} {...register('kind')}>
            {KINDS_BY_SERVICE[service].map((value) => (
              <option key={value} value={value}>
                {KIND_LABEL[value]}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField id={id('name')} label="Nombre" error={errors.name?.message}>
        <Input id={id('name')} {...fieldA11y(id('name'), errors.name?.message)} {...register('name')} />
      </FormField>
      <FormField id={id('slug')} label="Identificador" error={errors.slug?.message}>
        <Input id={id('slug')} autoComplete="off" {...fieldA11y(id('slug'), errors.slug?.message)} {...register('slug')} />
      </FormField>
      <FormField id={id('description')} label="Descripción" error={errors.description?.message}>
        <Textarea id={id('description')} rows={2} {...fieldA11y(id('description'), errors.description?.message)} {...register('description')} />
      </FormField>
      <FormField id={id('features')} label="Características (una por línea)" error={errors.features?.message}>
        <Textarea id={id('features')} rows={3} {...fieldA11y(id('features'), errors.features?.message)} {...register('features')} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id={id('price')} label="Precio (UYU)" error={errors.price?.message}>
          <Input
            id={id('price')}
            type="number"
            inputMode="numeric"
            max={MAX_MONEY_AMOUNT}
            {...fieldA11y(id('price'), errors.price?.message)}
            {...register('price')}
          />
        </FormField>
        {usage.periodMonths !== 'hidden' ? (
          <FormField id={id('periodMonths')} label="Meses" error={errors.periodMonths?.message}>
            <Input
              id={id('periodMonths')}
              type="number"
              inputMode="numeric"
              {...fieldA11y(id('periodMonths'), errors.periodMonths?.message)}
              {...register('periodMonths')}
            />
          </FormField>
        ) : null}
        {usage.periodDays !== 'hidden' ? (
          <FormField id={id('periodDays')} label="Días de vigencia" error={errors.periodDays?.message}>
            <Input
              id={id('periodDays')}
              type="number"
              inputMode="numeric"
              {...fieldA11y(id('periodDays'), errors.periodDays?.message)}
              {...register('periodDays')}
            />
          </FormField>
        ) : null}
        {usage.sessionsIncluded !== 'hidden' ? (
          <FormField id={id('sessionsIncluded')} label="Sesiones incluidas" error={errors.sessionsIncluded?.message}>
            <Input
              id={id('sessionsIncluded')}
              type="number"
              inputMode="numeric"
              {...fieldA11y(id('sessionsIncluded'), errors.sessionsIncluded?.message)}
              {...register('sessionsIncluded')}
            />
          </FormField>
        ) : null}
        {usage.durationMinutes !== 'hidden' ? (
          <FormField id={id('durationMinutes')} label="Duración (min)" error={errors.durationMinutes?.message}>
            <Input
              id={id('durationMinutes')}
              type="number"
              inputMode="numeric"
              {...fieldA11y(id('durationMinutes'), errors.durationMinutes?.message)}
              {...register('durationMinutes')}
            />
          </FormField>
        ) : null}
        <FormField id={id('sortOrder')} label="Orden" error={errors.sortOrder?.message}>
          <Input
            id={id('sortOrder')}
            type="number"
            inputMode="numeric"
            {...fieldA11y(id('sortOrder'), errors.sortOrder?.message)}
            {...register('sortOrder')}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Label htmlFor={id('featured')} className="min-h-8 text-sm">
          <input id={id('featured')} type="checkbox" className={CHECKBOX_CLASS} {...register('featured')} />
          Destacado
        </Label>
        <Label htmlFor={id('active')} className="min-h-8 text-sm">
          <input id={id('active')} type="checkbox" className={CHECKBOX_CLASS} {...register('active')} />
          Activo
        </Label>
        {AUTO_DEBIT_KINDS.includes(kind) ? (
          <Label htmlFor={id('autoDebitEnabled')} className="min-h-8 text-sm">
            <input id={id('autoDebitEnabled')} type="checkbox" className={CHECKBOX_CLASS} {...register('autoDebitEnabled')} />
            Permite débito automático
          </Label>
        ) : null}
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
