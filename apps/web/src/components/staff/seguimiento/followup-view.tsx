'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useBusinessToday } from '@/components/booking/day-selector';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { StaffPageHeader } from '@/components/move/staff-page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { AlertCountsDto, AlertDto, AlertType, JobRunResultDto } from '@/lib/api/types';
import { AlertCard } from './alert-card';
import { AlertFilters } from './alert-filters';
import { ALERT_LABEL, isAlertType } from './alert-labels';
import { ContactDialog, useRefreshFollowup, type ContactTarget } from './contact-dialog';
import { ReasonPanel } from './reason-panel';

const PATH = '/staff/seguimiento';

export function useHandleAlert() {
  const refresh = useRefreshFollowup();
  return useMutation({
    mutationFn: (alertId: string) => apiFetch<AlertDto>(`/staff/alerts/${alertId}/handle`, { method: 'POST' }),
    onSuccess: () => toast.success('Alerta marcada como gestionada'),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => refresh(),
  });
}

function useRunDetection() {
  const refresh = useRefreshFollowup();
  return useMutation({
    mutationFn: () => apiFetch<JobRunResultDto>('/staff/automations/run/followup-detect', { method: 'POST' }),
    onSuccess: (result) => (result.ran ? toast.success('Detección ejecutada') : toast.info('Ya hay una detección en curso')),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => refresh(),
  });
}

interface AlertListProps {
  type: AlertType | null;
  today: string | null;
}

function AlertList({ type, today }: AlertListProps) {
  const [contact, setContact] = useState<ContactTarget | null>(null);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const handle = useHandleAlert();
  const alerts = useQuery({
    queryKey: ['staff', 'alerts', 'list', type],
    queryFn: () => apiFetch<AlertDto[]>('/staff/alerts', { query: { ...(type ? { type } : {}), status: 'open' } }),
  });

  if (alerts.isError) return <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} />;
  if (alerts.isPending || today === null) return <Skeleton className="h-48" />;
  if (alerts.data.length === 0) {
    return (
      <EmptyState
        title="Sin alertas"
        description={type ? `No hay alertas de "${ALERT_LABEL[type]}" para revisar.` : 'No hay alertas abiertas para revisar.'}
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {alerts.data.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            today={today}
            busy={handle.isPending && handle.variables === alert.id}
            onContact={(item) => setContact({ alertId: item.id, clientName: item.client.name })}
            onHandle={(item) => handle.mutate(item.id)}
            onReason={(item) => setReasonFor((current) => (current === item.id ? null : item.id))}
          >
            {reasonFor === alert.id ? <ReasonPanel clientId={alert.client.id} today={today} onDone={() => setReasonFor(null)} /> : null}
          </AlertCard>
        ))}
      </div>
      <ContactDialog target={contact} onClose={() => setContact(null)} />
    </>
  );
}

export function FollowupView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = useBusinessToday();
  const detection = useRunDetection();
  const tipo = searchParams.get('tipo');
  const selected = isAlertType(tipo) ? tipo : null;
  const counts = useQuery({
    queryKey: ['staff', 'alerts', 'counts'],
    queryFn: () => apiFetch<AlertCountsDto>('/staff/alerts/counts'),
  });

  return (
    <>
      <StaffPageHeader
        title="Seguimiento y retención"
        actions={
          <Button
            variant="outline"
            className="h-auto px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
            disabled={detection.isPending}
            onClick={() => detection.mutate()}
          >
            Ejecutar detección ahora
          </Button>
        }
      />
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Alertas automáticas sobre situaciones que requieren revisión del equipo. Cada alerta permite contactar al cliente y registrar el
        resultado del seguimiento.
      </p>
      <div className="mt-6">
        <AlertFilters counts={counts.data} selected={selected} onSelect={(type) => router.replace(type ? `${PATH}?tipo=${type}` : PATH)} />
      </div>
      <div className="mt-6">
        <AlertList type={selected} today={today} />
      </div>
    </>
  );
}
