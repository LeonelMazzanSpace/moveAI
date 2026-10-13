'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { InactivityReasonCode } from '@/lib/api/types';
import { businessTodayWeb } from '@/lib/format';
import { cn } from '@/lib/utils';
import { INACTIVITY_REASON_CODES, INACTIVITY_REASON_LABEL } from './inactivity-reasons';

const NOTE_MAX_LENGTH = 1000;

export interface InactivityReasonValues {
  reason: InactivityReasonCode;
  note?: string;
  recontactOn?: string;
}

interface InactivityReasonFormProps {
  onSubmit: (values: InactivityReasonValues) => void;
  submitting: boolean;
}

interface FormErrors {
  reason?: string;
  recontactOn?: string;
}

function validate(reason: InactivityReasonCode | null, recontactOn: string): FormErrors {
  const errors: FormErrors = {};
  if (!reason) errors.reason = 'Elegí un motivo.';
  if (recontactOn && recontactOn < businessTodayWeb()) {
    errors.recontactOn = 'La fecha de re-contacto no puede ser anterior a hoy.';
  }
  return errors;
}

export function InactivityReasonForm({ onSubmit, submitting }: InactivityReasonFormProps) {
  const [reason, setReason] = useState<InactivityReasonCode | null>(null);
  const [note, setNote] = useState('');
  const [recontactOn, setRecontactOn] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(reason, recontactOn);
    setErrors(found);
    if (!reason || found.recontactOn) return;
    const trimmed = note.trim();
    onSubmit({ reason, ...(trimmed && { note: trimmed }), ...(recontactOn && { recontactOn }) });
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <div role="group" aria-label="Motivo" className="flex flex-wrap gap-2">
        {INACTIVITY_REASON_CODES.map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={code === reason}
            onClick={() => setReason(code)}
            className={cn(
              'rounded px-3 py-1.5 text-[11px] font-semibold',
              code === reason ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-soft',
            )}
          >
            {INACTIVITY_REASON_LABEL[code]}
          </button>
        ))}
      </div>
      {errors.reason ? (
        <p role="alert" className="text-xs text-danger">
          {errors.reason}
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
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inactivity-recontact" className="text-xs text-muted-foreground">
          Fecha de re-contacto
        </Label>
        <Input
          id="inactivity-recontact"
          type="date"
          value={recontactOn}
          aria-invalid={errors.recontactOn ? true : undefined}
          className="w-44"
          onChange={(event) => setRecontactOn(event.target.value)}
        />
        {errors.recontactOn ? (
          <p role="alert" className="text-xs text-danger">
            {errors.recontactOn}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={submitting}>
        Registrar motivo
      </Button>
    </form>
  );
}
