'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type { InactivityReasonCode } from '@/lib/api/types';
import { businessTodayWeb } from '@/lib/format';
import { cn } from '@/lib/utils';
import { INACTIVITY_REASON_CODES, INACTIVITY_REASON_LABEL } from './inactivity-reasons';

export const NOTE_MAX_LENGTH = 1000;
export const NOTE_TOO_LONG = `La nota es demasiado larga (máximo ${NOTE_MAX_LENGTH} caracteres).`;
export const NOTE_INVALID_CHARS = 'La nota contiene caracteres no permitidos.';

const STALE_PAUSE_CODES: readonly string[] = ['NO_ACTIVE_PAUSE', 'PAUSE_ALREADY_ACTIVE'];

/** The screen was out of date: the pause was ended or started somewhere else. */
export function isStalePauseError(error: unknown): boolean {
  return error instanceof ApiError && STALE_PAUSE_CODES.includes(error.code);
}

/**
 * Puts the API's field errors in their fields with our own Spanish copy (the API text is English
 * class-validator output and is never shown); anything not tied to a known field goes to `root`.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldMessages: Partial<Record<Path<T>, string>>,
): void {
  const details = error instanceof ApiError ? (error.details ?? []) : [];
  let placed = false;
  for (const { field } of details) {
    if (!Object.hasOwn(fieldMessages, field)) continue;
    const message = fieldMessages[field as Path<T>];
    if (!message) continue;
    setError(field as Path<T>, { message });
    placed = true;
  }
  if (!placed) setError('root', { message: errorMessage(error) });
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

const FIELD_MESSAGES: Partial<Record<Path<InactivityReasonFormValues>, string>> = {
  reason: 'Elegí un motivo válido.',
  note: 'La nota no es válida.',
  recontactOn: 'La fecha de re-contacto no es válida.',
};

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
      applyApiError(error, setError, FIELD_MESSAGES);
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
                className={cn(
                  'rounded px-3 py-1.5 text-[11px] font-semibold',
                  code === field.value ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-soft',
                )}
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
