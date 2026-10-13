'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type {
  AlertCountsDto,
  AlertDto,
  ContactChannel,
  ContactDto,
  ContactOutcome,
  InactivityReasonDto,
  JobRunResultDto,
} from '@/lib/api/types';
import { isStalePauseError, type InactivityReasonValues } from '../shared/inactivity-reason-form';

/** Same key as the sidebar badge, so one request and one cache entry feed both. */
export const ALERT_COUNTS_KEY = ['staff', 'alert-counts'] as const;

/** Refresca alertas, contadores (incluido el badge del sidebar) y respuestas de check-in. */
export function useRefreshFollowup() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['staff', 'alerts'] }),
      queryClient.invalidateQueries({ queryKey: ALERT_COUNTS_KEY }),
      queryClient.invalidateQueries({ queryKey: ['staff', 'checkins'] }),
    ]);
}

export function useAlertCounts() {
  return useQuery({ queryKey: ALERT_COUNTS_KEY, queryFn: () => apiFetch<AlertCountsDto>('/staff/alerts/counts') });
}

export function useHandleAlert() {
  const refresh = useRefreshFollowup();
  return useMutation({
    mutationFn: (alertId: string) => apiFetch<AlertDto>(`/staff/alerts/${encodeURIComponent(alertId)}/handle`, { method: 'POST' }),
    onSuccess: () => toast.success('Alerta marcada como gestionada'),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => refresh(),
  });
}

export function useRunDetection() {
  const refresh = useRefreshFollowup();
  return useMutation({
    mutationFn: () => apiFetch<JobRunResultDto>('/staff/automations/run/followup-detect', { method: 'POST' }),
    onSuccess: (result) => (result.ran ? toast.success('Detección ejecutada') : toast.info('Ya hay una detección en curso')),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => refresh(),
  });
}

export interface ContactValues {
  channel: ContactChannel;
  outcome: ContactOutcome;
  note?: string;
}

export function useCreateContact(alertId: string) {
  const refresh = useRefreshFollowup();
  return useMutation({
    mutationFn: (values: ContactValues) =>
      apiFetch<ContactDto>(`/staff/alerts/${encodeURIComponent(alertId)}/contacts`, { method: 'POST', body: values }),
    onSuccess: async () => {
      await refresh();
      toast.success('Contacto registrado');
    },
  });
}

export function useStartInactivity(clientId: string) {
  const refresh = useRefreshFollowup();
  return useMutation({
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
}
