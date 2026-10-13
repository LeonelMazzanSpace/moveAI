'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { ContactChannel, ContactDto, ContactOutcome } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { CHANNEL_LABEL, OUTCOME_LABEL } from './alert-labels';

const NOTE_MAX_LENGTH = 1000;
const CHANNELS = Object.keys(CHANNEL_LABEL) as ContactChannel[];
const OUTCOMES = Object.keys(OUTCOME_LABEL) as ContactOutcome[];

/** Refresca alertas, contadores (incluido el badge del sidebar) y respuestas de check-in. */
export function useRefreshFollowup() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['staff', 'alerts'] }),
      queryClient.invalidateQueries({ queryKey: ['staff', 'alert-counts'] }),
      queryClient.invalidateQueries({ queryKey: ['staff', 'checkins'] }),
    ]);
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
  const refresh = useRefreshFollowup();
  const [channel, setChannel] = useState<ContactChannel>('whatsapp');
  const [outcome, setOutcome] = useState<ContactOutcome>('reached');
  const [note, setNote] = useState('');
  const mutation = useMutation({
    mutationFn: () => {
      const trimmed = note.trim();
      return apiFetch<ContactDto>(`/staff/alerts/${target.alertId}/contacts`, {
        method: 'POST',
        body: { channel, outcome, ...(trimmed ? { note: trimmed } : {}) },
      });
    },
    onSuccess: async () => {
      await refresh();
      toast.success('Contacto registrado');
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Contactar a {target.clientName}</DialogTitle>
            <DialogDescription>Registrá cómo fue el contacto para que quede en el historial.</DialogDescription>
          </DialogHeader>
          <ChoiceChips label="Canal" options={CHANNELS} labels={CHANNEL_LABEL} value={channel} onChange={setChannel} />
          <ChoiceChips label="Resultado" options={OUTCOMES} labels={OUTCOME_LABEL} value={outcome} onChange={setOutcome} />
          <div className="grid gap-2">
            <Label htmlFor="contact-note">Nota</Label>
            <Textarea id="contact-note" maxLength={NOTE_MAX_LENGTH} placeholder="Nota interna (opcional)…" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          {mutation.error ? (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(mutation.error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Volver
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
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
