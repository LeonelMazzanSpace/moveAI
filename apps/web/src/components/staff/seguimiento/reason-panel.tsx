'use client';

import { InactivityReasonForm } from '../shared/inactivity-reason-form';
import { useStartInactivity } from './use-followup';

interface ReasonPanelProps {
  clientId: string;
  onDone: () => void;
}

export function ReasonPanel({ clientId, onDone }: ReasonPanelProps) {
  const start = useStartInactivity(clientId);

  return (
    <div className="mt-5 rounded border border-border bg-soft p-4">
      <p className="mb-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Registrar motivo de inactividad</p>
      <InactivityReasonForm
        submitLabel="Guardar"
        onSubmit={async (values) => {
          await start.mutateAsync(values);
          onDone();
        }}
      />
    </div>
  );
}
