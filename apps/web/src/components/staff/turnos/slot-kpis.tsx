import type { ReactNode } from 'react';
import type { StaffTimeSlotDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';

interface KpiProps {
  label: string;
  tone?: 'success' | 'danger' | 'muted';
  children: ReactNode;
  detail?: string;
}

const TONE_CLASSES = {
  success: 'text-success',
  danger: 'text-danger',
  muted: 'text-muted-foreground',
};

function Kpi({ label, tone, children, detail }: KpiProps) {
  return (
    <div role="group" aria-label={label} className="rounded border border-border bg-card p-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className={cn('mt-2 font-display text-3xl font-black', tone && TONE_CLASSES[tone])}>{children}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function SlotKpis({ slot }: { slot: StaffTimeSlotDto }) {
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <Kpi label="Reservas">
        {slot.booked}
        <span className="text-base text-muted-foreground">/{slot.capacity}</span>
      </Kpi>
      <Kpi label="Presentes" tone="success">
        {slot.present}
      </Kpi>
      <Kpi label="Ausentes + No show" tone="danger" detail={`Ausentes ${slot.absent} · No show ${slot.noShow}`}>
        {slot.absent + slot.noShow}
      </Kpi>
      <Kpi label="Cancelaciones" tone="muted">
        {slot.cancelled}
      </Kpi>
    </div>
  );
}
