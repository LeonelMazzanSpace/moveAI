'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { InactivityReasonCode, InactivityReasonDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { REASON_LABEL, REASON_ORDER } from './alert-labels';
import { useRefreshFollowup } from './contact-dialog';

const NOTE_MAX_LENGTH = 1000;
const FIELD_CLASS = 'h-auto rounded border-border bg-card px-3 py-1.5 text-xs';

interface ReasonPanelProps {
  clientId: string;
  today: string;
  onDone: () => void;
}

export function ReasonPanel({ clientId, today, onDone }: ReasonPanelProps) {
  const refresh = useRefreshFollowup();
  const [reason, setReason] = useState<InactivityReasonCode | null>(null);
  const [note, setNote] = useState('');
  const [recontactOn, setRecontactOn] = useState('');
  const mutation = useMutation({
    mutationFn: (code: InactivityReasonCode) => {
      const trimmed = note.trim();
      return apiFetch<InactivityReasonDto>(`/staff/clients/${clientId}/inactivity-reasons`, {
        method: 'POST',
        body: { reason: code, ...(trimmed ? { note: trimmed } : {}), ...(recontactOn ? { recontactOn } : {}) },
      });
    },
    onSuccess: async () => {
      await refresh();
      toast.success('Motivo registrado');
      onDone();
    },
  });

  return (
    <div className="mt-5 rounded border border-border bg-soft p-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Registrar motivo de inactividad</p>
      <div role="group" aria-label="Motivo" className="mt-3 flex flex-wrap gap-2 text-xs">
        {REASON_ORDER.map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={code === reason}
            onClick={() => setReason(code)}
            className={cn(
              'rounded px-3 py-1.5',
              code === reason ? 'bg-primary font-semibold text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {REASON_LABEL[code]}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input
          aria-label="Nota interna"
          placeholder="Nota interna (opcional)…"
          maxLength={NOTE_MAX_LENGTH}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={cn(FIELD_CLASS, 'min-w-48 flex-1')}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Re-contactar el
          <Input
            type="date"
            min={today}
            value={recontactOn}
            onChange={(event) => setRecontactOn(event.target.value)}
            className={cn(FIELD_CLASS, 'w-40')}
          />
        </label>
        <Button
          className="h-auto shrink-0 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
          disabled={reason === null || mutation.isPending}
          onClick={() => reason && mutation.mutate(reason)}
        >
          Guardar
        </Button>
      </div>
      {mutation.error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {errorMessage(mutation.error)}
        </p>
      ) : null}
    </div>
  );
}
