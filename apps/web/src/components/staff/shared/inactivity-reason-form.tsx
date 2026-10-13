'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, errorMessage } from '@/lib/api/errors';
import { applyFieldErrors } from '@/lib/api/field-errors';
import type { InactivityReasonCode } from '@/lib/api/types';
import { businessTodayWeb } from '@/lib/format';
import { INACTIVITY_REASON_CODES, INACTIVITY_REASON_LABEL } from './inactivity-reasons';

export const NOTE_MAX_LENGTH = 1000;
export const NOTE_TOO_LONG = `La nota es demasiado larga (máximo ${NOTE_MAX_LENGTH} caracteres).`;
export const NOTE_INVALID_CHARS = 'La nota contiene caracteres no permitidos.';

const STALE_PAUSE_CODES: readonly string[] = ['NO_ACTIVE_PAUSE', 'PAUSE_ALREADY_ACTIVE'];

/** The screen was out of date: the pause was ended or started somewhere else. */
export function isStalePauseError(error: unknown): boolean {
  return error instanceof ApiError && STALE_PAUSE_CODES.includes(error.code);
}

const NUL = '\u0000';
const RECONTACT_MAX = '2099-12-31';

const inactivityReasonSchema = z.object({
  reason: z.custom<InactivityReasonCode>((value) => typeof value === 'string' && Object.hasOwn(INACTIVITY_REASON_LABEL, value), 'Elegí un motivo.'),
  note: z
    .string()
    .trim()
    .max(NOTE_MAX_LENGTH, NOTE_TOO_LONG)
    .refine((value) => !value.includes(NUL), NOTE_INVALID_CHARS),
  recontactOn: z
    .string()
    .refine((value) => value === '' || value >= businessTodayWeb(), 'La fecha de re-contacto no puede ser anterior a hoy.')
    .refine((value) => value === '' || value <= RECONTACT_MAX, 'La fecha de re-contacto no puede ser posterior a 2099.'),
});

type InactivityReasonFormValues = z.infer<typeof inactivityReasonSchema>;

const FORM_FIELDS = ['reason', 'note', 'recontactOn'] as const;

const FIELD_MESSAGES = {
  reason: 'Elegí un motivo válido.',
  note: 'La nota no es válida.',
  recontactOn: 'La fecha de re-contacto no es válida.',
} satisfies Partial<Record<(typeof FORM_FIELDS)[number], string>>;

export interface InactivityReasonValues {
  reason: InactivityReasonCode;
  note?: string;
  recontactOn?: string;
}

function toPayload({ reason, note, recontactOn }: InactivityReasonFormValues): InactivityReasonValues {
  return { reason, ...(note && { note }), ...(recontactOn && { recontactOn }) };
}

interface InactivityReasonFormProps {
  onSubmit: (values: InactivityReasonValues) => Promise<unknown>;
  submitLabel?: string;
}

export function InactivityReasonForm({ onSubmit, submitLabel = 'Registrar motivo' }: InactivityReasonFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InactivityReasonFormValues>({ resolver: zodResolver(inactivityReasonSchema), defaultValues: { note: '', recontactOn: '' } });

  async function submit(values: InactivityReasonFormValues) {
    try {
      await onSubmit(toPayload(values));
    } catch (error) {
      if (!applyFieldErrors(error, FORM_FIELDS, setError, {}, FIELD_MESSAGES)) setError('root', { message: errorMessage(error) });
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="space-y-4">
      <Controller
        control={control}
        name="reason"
        render={({ field }) => (
          <div role="group" aria-label="Motivo" className="flex flex-wrap gap-2">
            {INACTIVITY_REASON_CODES.map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={code === field.value}
                onClick={() => field.onChange(code)}
                className={buttonVariants({ variant: code === field.value ? 'default' : 'outline', size: 'lg' })}
              >
                {INACTIVITY_REASON_LABEL[code]}
              </button>
            ))}
          </div>
        )}
      />
      {errors.reason ? (
        <p role="alert" className="text-xs text-danger">
          {errors.reason.message}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="inactivity-note" className="text-xs text-muted-foreground">
          Nota interna (opcional)
        </Label>
        <Textarea
          id="inactivity-note"
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          aria-invalid={errors.note ? true : undefined}
          {...register('note')}
        />
        {errors.note ? <p className="text-xs text-danger">{errors.note.message}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inactivity-recontact" className="text-xs text-muted-foreground">
          Fecha de re-contacto
        </Label>
        <Input
          id="inactivity-recontact"
          type="date"
          aria-invalid={errors.recontactOn ? true : undefined}
          className="w-44"
          {...register('recontactOn')}
        />
        {errors.recontactOn ? <p className="text-xs text-danger">{errors.recontactOn.message}</p> : null}
      </div>
      {errors.root ? (
        <p role="alert" className="text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
