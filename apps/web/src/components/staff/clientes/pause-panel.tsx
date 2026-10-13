'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { InactivityReasonDto } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { InactivityReasonForm, isStalePauseError, type InactivityReasonValues } from '../shared/inactivity-reason-form';
import { INACTIVITY_REASON_LABEL } from '../shared/inactivity-reasons';

export function useRefreshClients() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['staff', 'clients'] }),
      queryClient.invalidateQueries({ queryKey: ['staff', 'dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['staff', 'alerts'] }),
    ]);
}

function ActivePause({ clientId, pause }: { clientId: string; pause: InactivityReasonDto }) {
  const refresh = useRefreshClients();
  const [confirming, setConfirming] = useState(false);
  const end = useMutation({
    mutationFn: () => apiFetch<InactivityReasonDto>(`/staff/clients/${encodeURIComponent(clientId)}/inactivity-reasons/end`, { method: 'POST' }),
    onSuccess: async () => {
      await refresh();
      toast.success('Pausa finalizada');
      setConfirming(false);
    },
    onError: (error) => {
      if (isStalePauseError(error)) void refresh();
    },
  });

  return (
    <>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{INACTIVITY_REASON_LABEL[pause.reason]}</p>
        <p className="text-xs text-muted-foreground">{`Desde ${formatDate(pause.startedAt)}`}</p>
        {pause.recontactOn ? <p className="text-xs text-muted-foreground">{`Re-contacto el ${formatDate(pause.recontactOn)}`}</p> : null}
        {pause.note ? <p className="pt-1 text-sm text-muted-foreground">{pause.note}</p> : null}
      </div>
      <Button variant="outline" className="mt-4" onClick={() => setConfirming(true)}>
        Finalizar pausa
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar pausa</DialogTitle>
            <DialogDescription>
              El cliente vuelve a recibir alertas y avisos automáticos según su plan y su asistencia.
            </DialogDescription>
          </DialogHeader>
          {end.error ? (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(end.error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Volver
            </Button>
            <Button disabled={end.isPending} onClick={() => end.mutate()}>
              Sí, finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewReason({ clientId }: { clientId: string }) {
  const refresh = useRefreshClients();
  const start = useMutation({
    mutationFn: (values: InactivityReasonValues) =>
      apiFetch<InactivityReasonDto>(`/staff/clients/${encodeURIComponent(clientId)}/inactivity-reasons`, { method: 'POST', body: values }),
    onSuccess: async () => {
      await refresh();
      toast.success('Motivo registrado');
    },
    onError: (error) => {
      if (isStalePauseError(error)) void refresh();
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Registrar un motivo pausa al cliente: no recibe alertas ni emails automáticos hasta que finalice la pausa.
      </p>
      <InactivityReasonForm onSubmit={(values) => start.mutateAsync(values)} />
    </div>
  );
}

interface PausePanelProps {
  clientId: string;
  activePause: InactivityReasonDto | null;
}

export function PausePanel({ clientId, activePause }: PausePanelProps) {
  return activePause ? <ActivePause clientId={clientId} pause={activePause} /> : <NewReason clientId={clientId} />;
}
