'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, FormField, fieldA11y, INTEGER_PATTERN, SELECT_CLASS } from '@/components/staff/form-primitives';
import { Input } from '@/components/ui/input';
import { applyFieldErrors } from '@/lib/api/field-errors';
import type { ProfessionalDto, Service } from '@/lib/api/types';
import { SERVICE_LABEL } from '@/lib/format';
import { SERVICES } from './plan-form.schema';

export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DURATION_RANGE = [15, 240] as const;
const CAPACITY_RANGE = [1, 100] as const;
const DEFAULT_CAPACITY = '14';
const REHAB_CAPACITY = '1';

type FormMode = 'template' | 'slot';

const FORM_FIELDS: readonly (keyof TemplateFormInput)[] = [
  'service',
  'weekday',
  'date',
  'startTime',
  'durationMinutes',
  'capacity',
  'professionalId',
];

function integerInRange(raw: string, [min, max]: readonly [number, number], addIssue: (message: string) => void): number {
  const text = raw.trim();
  const value = Number(text);
  if (text === '') addIssue('Ingresá un valor.');
  else if (!INTEGER_PATTERN.test(text)) addIssue('Ingresá un número entero.');
  else if (value < min || value > max) addIssue(`Debe estar entre ${min} y ${max}.`);
  return value;
}

function createSchema(mode: FormMode) {
  return z
    .object({
      service: z.enum(['performance', 'rehab', 'recovery']),
      weekday: z.string(),
      date: z.string(),
      startTime: z.string().regex(TIME_PATTERN, 'Ingresá una hora válida (HH:mm).'),
      durationMinutes: z.string(),
      capacity: z.string(),
      professionalId: z.string(),
    })
    .superRefine((values, ctx) => {
      const issue = (path: keyof typeof values) => (message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
      if (mode === 'template' && !['1', '2', '3', '4', '5', '6', '7'].includes(values.weekday)) {
        issue('weekday')('Elegí un día.');
      }
      if (mode === 'slot' && !DATE_PATTERN.test(values.date)) issue('date')('Ingresá una fecha válida.');
      integerInRange(values.durationMinutes, DURATION_RANGE, issue('durationMinutes'));
      if (values.service === 'rehab') {
        if (values.professionalId === '') issue('professionalId')(`Elegí un profesional para ${SERVICE_LABEL.rehab}.`);
        return;
      }
      integerInRange(values.capacity, CAPACITY_RANGE, issue('capacity'));
    })
    .transform((values) => ({
      service: values.service,
      weekday: Number(values.weekday),
      date: values.date,
      startTime: values.startTime,
      durationMinutes: Number(values.durationMinutes),
      capacity: values.service === 'rehab' ? 1 : Number(values.capacity),
      professionalId: values.professionalId === '' ? undefined : values.professionalId,
    }));
}

type TemplateFormInput = z.input<ReturnType<typeof createSchema>>;
type TemplateFormValues = z.output<ReturnType<typeof createSchema>>;

interface BodyBase {
  service: Service;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  professionalId?: string;
}
export interface TemplateBody extends BodyBase {
  weekday: number;
}
export interface SlotBody extends BodyBase {
  date: string;
}

type TemplateFormProps = { professionals: ProfessionalDto[]; submitting?: boolean; onCancel?: () => void } & (
  | { mode: 'template'; onSubmit: (body: TemplateBody) => unknown }
  | { mode: 'slot'; onSubmit: (body: SlotBody) => unknown }
);

function baseBody(values: TemplateFormValues): BodyBase {
  const { service, startTime, durationMinutes, capacity, professionalId } = values;
  return { service, startTime, durationMinutes, capacity, professionalId };
}

export function TemplateForm(props: TemplateFormProps) {
  const { mode, professionals, submitting = false, onCancel } = props;
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const schema = useMemo(() => createSchema(mode), [mode]);
  const defaultValues: TemplateFormInput = {
    service: 'performance',
    weekday: '1',
    date: '',
    startTime: '',
    durationMinutes: '60',
    capacity: DEFAULT_CAPACITY,
    professionalId: '',
  };
  const { register, handleSubmit, setValue, setError, control, formState } = useForm<TemplateFormInput, unknown, TemplateFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const { errors } = formState;
  const isRehab = useWatch({ control, name: 'service' }) === 'rehab';

  const serviceField = register('service', {
    onChange: (event) => {
      if (event.target.value === 'rehab') setValue('capacity', REHAB_CAPACITY);
      else if (isRehab) setValue('capacity', DEFAULT_CAPACITY);
    },
  });

  async function onValid(values: TemplateFormValues) {
    try {
      if (props.mode === 'template') await props.onSubmit({ ...baseBody(values), weekday: values.weekday });
      else await props.onSubmit({ ...baseBody(values), date: values.date });
    } catch (error) {
      applyFieldErrors(error, FORM_FIELDS, setError);
    }
  }

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField id={id('service')} label="Servicio" error={errors.service?.message}>
          <select id={id('service')} className={SELECT_CLASS} {...fieldA11y(id('service'), errors.service?.message)} {...serviceField}>
            {SERVICES.map((value) => (
              <option key={value} value={value}>
                {SERVICE_LABEL[value]}
              </option>
            ))}
          </select>
        </FormField>
        {mode === 'template' ? (
          <FormField id={id('weekday')} label="Día" error={errors.weekday?.message}>
            <select id={id('weekday')} className={SELECT_CLASS} {...fieldA11y(id('weekday'), errors.weekday?.message)} {...register('weekday')}>
              {WEEKDAY_SHORT.map((label, index) => (
                <option key={label} value={String(index + 1)}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
        ) : (
          <FormField id={id('date')} label="Fecha" error={errors.date?.message}>
            <Input id={id('date')} type="date" {...fieldA11y(id('date'), errors.date?.message)} {...register('date')} />
          </FormField>
        )}
        <FormField id={id('startTime')} label="Hora" error={errors.startTime?.message}>
          <Input id={id('startTime')} type="time" {...fieldA11y(id('startTime'), errors.startTime?.message)} {...register('startTime')} />
        </FormField>
        <FormField id={id('durationMinutes')} label="Duración (min)" error={errors.durationMinutes?.message}>
          <Input
            id={id('durationMinutes')}
            type="number"
            inputMode="numeric"
            {...fieldA11y(id('durationMinutes'), errors.durationMinutes?.message)}
            {...register('durationMinutes')}
          />
        </FormField>
        <FormField
          id={id('capacity')}
          label={isRehab ? `Cupo (fijo en ${SERVICE_LABEL.rehab})` : 'Cupo'}
          error={errors.capacity?.message}
        >
          <Input
            id={id('capacity')}
            type="number"
            inputMode="numeric"
            readOnly={isRehab}
            {...fieldA11y(id('capacity'), errors.capacity?.message)}
            {...register('capacity')}
          />
        </FormField>
        <FormField
          id={id('professionalId')}
          label={isRehab ? 'Profesional (obligatorio)' : 'Profesional'}
          error={errors.professionalId?.message}
        >
          <select
            id={id('professionalId')}
            className={SELECT_CLASS}
            {...fieldA11y(id('professionalId'), errors.professionalId?.message)}
            {...register('professionalId')}
          >
            <option value="">{isRehab ? 'Elegí un profesional' : 'Sin profesional'}</option>
            {professionals.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.name}
              </option>
            ))}
          </select>
        </FormField>
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
