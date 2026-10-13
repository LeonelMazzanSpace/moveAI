'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type Path } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ContactChannel, ContactOutcome } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { applyApiError, NOTE_INVALID_CHARS, NOTE_MAX_LENGTH, NOTE_TOO_LONG } from '../shared/inactivity-reason-form';
import { CHANNEL_LABEL, OUTCOME_LABEL } from './alert-labels';
import { useCreateContact, type ContactValues } from './use-followup';

const CHANNELS = Object.keys(CHANNEL_LABEL) as ContactChannel[];
const OUTCOMES = Object.keys(OUTCOME_LABEL) as ContactOutcome[];

const contactSchema = z.object({
  channel: z.custom<ContactChannel>((value) => typeof value === 'string' && Object.hasOwn(CHANNEL_LABEL, value), 'Elegí un canal.'),
  outcome: z.custom<ContactOutcome>((value) => typeof value === 'string' && Object.hasOwn(OUTCOME_LABEL, value), 'Elegí un resultado.'),
  note: z
    .string()
    .trim()
    .max(NOTE_MAX_LENGTH, NOTE_TOO_LONG)
    .refine((value) => !value.includes('\u0000'), NOTE_INVALID_CHARS),
});

type ContactFormValues = z.infer<typeof contactSchema>;

const FIELD_MESSAGES: Partial<Record<Path<ContactFormValues>, string>> = {
  channel: 'Elegí un canal válido.',
  outcome: 'Elegí un resultado válido.',
  note: 'La nota no es válida.',
};

function toPayload({ channel, outcome, note }: ContactFormValues): ContactValues {
  return { channel, outcome, ...(note && { note }) };
}

export interface ContactTarget {
  alertId: string;
  clientName: string;
}

interface ChoiceChipsProps<T extends string> {
  label: string;
  options: T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}

function ChoiceChips<T extends string>({ label, options, labels, value, onChange }: ChoiceChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className="grid gap-2">
      <p className="text-xs font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => onChange(option)}
            className={cn(
              'rounded px-3 py-1.5 text-xs',
              option === value ? 'bg-primary font-semibold text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

function ContactForm({ target, onClose }: { target: ContactTarget; onClose: () => void }) {
  const create = useCreateContact(target.alertId);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema), defaultValues: { channel: 'whatsapp', outcome: 'reached', note: '' } });

  async function onSubmit(values: ContactFormValues) {
    try {
      await create.mutateAsync(toPayload(values));
      onClose();
    } catch (error) {
      applyApiError(error, setError, FIELD_MESSAGES);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Contactar a {target.clientName}</DialogTitle>
            <DialogDescription>Registrá cómo fue el contacto para que quede en el historial.</DialogDescription>
          </DialogHeader>
          <Controller
            control={control}
            name="channel"
            render={({ field }) => <ChoiceChips label="Canal" options={CHANNELS} labels={CHANNEL_LABEL} value={field.value} onChange={field.onChange} />}
          />
          {errors.channel ? <p className="text-xs text-danger">{errors.channel.message}</p> : null}
          <Controller
            control={control}
            name="outcome"
            render={({ field }) => <ChoiceChips label="Resultado" options={OUTCOMES} labels={OUTCOME_LABEL} value={field.value} onChange={field.onChange} />}
          />
          {errors.outcome ? <p className="text-xs text-danger">{errors.outcome.message}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="contact-note">Nota</Label>
            <Textarea
              id="contact-note"
              maxLength={NOTE_MAX_LENGTH}
              placeholder="Nota interna (opcional)…"
              aria-invalid={errors.note ? true : undefined}
              {...register('note')}
            />
            {errors.note ? <p className="text-xs text-danger">{errors.note.message}</p> : null}
          </div>
          {errors.root ? (
            <p role="alert" className="text-sm text-danger">
              {errors.root.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Volver
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Guardar contacto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ContactDialog({ target, onClose }: { target: ContactTarget | null; onClose: () => void }) {
  if (!target) return null;
  return <ContactForm key={target.alertId} target={target} onClose={onClose} />;
}
