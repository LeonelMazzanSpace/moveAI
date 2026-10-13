'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useBusinessToday } from '@/components/booking/day-selector';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { StaffPageHeader } from '@/components/move/staff-page-header';
import { ContactDialog, useRefreshFollowup, type ContactTarget } from '@/components/staff/seguimiento/contact-dialog';
import { useHandleAlert } from '@/components/staff/seguimiento/followup-view';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { CheckinResponseDto, CheckinStatsDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { ResponseCard } from './response-card';
import { StudentPreview } from './student-preview';

function Kpi({ label, tone, children }: { label: string; tone?: 'warning'; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="rounded border border-border bg-card p-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className={cn('mt-2 font-display text-3xl font-black', tone === 'warning' && 'text-warning')}>{children}</p>
    </div>
  );
}

function StatsRow() {
  const stats = useQuery({
    queryKey: ['staff', 'checkins', 'stats'],
    queryFn: () => apiFetch<CheckinStatsDto>('/staff/checkins/stats'),
  });

  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />;
  if (stats.isPending) return <Skeleton className="h-24" />;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Kpi label="Enviados">{stats.data.sent}</Kpi>
      <Kpi label="Respondidos">{stats.data.answered}</Kpi>
      <Kpi label="Requieren intervención" tone="warning">
        {stats.data.needsIntervention}
      </Kpi>
    </div>
  );
}

function useReferToRehab() {
  const refresh = useRefreshFollowup();
  return useMutation({
    mutationFn: (checkinId: string) => apiFetch<CheckinResponseDto>(`/staff/checkins/${checkinId}/refer-rehab`, { method: 'POST' }),
    onSuccess: () => toast.success('Derivado a Rehab'),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => refresh(),
  });
}

function ResponseList({ today }: { today: string | null }) {
  const [contact, setContact] = useState<ContactTarget | null>(null);
  const [referred, setReferred] = useState<ReadonlySet<string>>(new Set());
  const handle = useHandleAlert();
  const refer = useReferToRehab();
  const responses = useQuery({
    queryKey: ['staff', 'checkins', 'responses'],
    queryFn: () => apiFetch<CheckinResponseDto[]>('/staff/checkins/responses'),
  });

  if (responses.isError) return <ErrorState error={responses.error} onRetry={() => void responses.refetch()} />;
  if (responses.isPending || today === null) return <Skeleton className="h-48" />;
  if (responses.data.length === 0) {
    return <EmptyState title="Sin respuestas" description="Todavía no hay check-ins respondidos en este período." />;
  }

  return (
    <>
      <div className="space-y-4">
        {responses.data.map((response) => (
          <ResponseCard
            key={response.id}
            response={response}
            today={today}
            busy={(handle.isPending && handle.variables === response.alertId) || (refer.isPending && refer.variables === response.id)}
            onContact={(item) => item.alertId && setContact({ alertId: item.alertId, clientName: item.client.name })}
            referred={referred.has(response.id)}
            onRefer={(item) => refer.mutate(item.id, { onSuccess: () => setReferred((ids) => new Set(ids).add(item.id)) })}
            onHandle={(item) => item.alertId && handle.mutate(item.alertId)}
          />
        ))}
      </div>
      <ContactDialog target={contact} onClose={() => setContact(null)} />
    </>
  );
}

function useSendCheckins() {
  const refresh = useRefreshFollowup();
  return useMutation({
    mutationFn: () => apiFetch<{ sent: number; period: string }>('/staff/checkins/send', { method: 'POST' }),
    onSuccess: ({ sent }) => toast.success(sent === 1 ? 'Enviamos 1 check-in' : `Enviamos ${sent} check-ins`),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => refresh(),
  });
}

export function CheckinsView() {
  const today = useBusinessToday();
  const send = useSendCheckins();

  return (
    <>
      <StaffPageHeader
        title="Check-in de clientes"
        actions={
          <Button
            className="h-auto px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
            disabled={send.isPending}
            onClick={() => send.mutate()}
          >
            Enviar check-in
          </Button>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        <StudentPreview />
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Respuestas y alertas para el equipo</p>
          <div className="mt-4">
            <StatsRow />
          </div>
          <div className="mt-6">
            <ResponseList today={today} />
          </div>
        </div>
      </div>
    </>
  );
}
