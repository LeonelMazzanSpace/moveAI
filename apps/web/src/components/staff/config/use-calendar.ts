'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { CalendarStatusDto, GoogleCalendarOptionDto } from '@/lib/api/types';

const CALENDAR_KEY = ['staff', 'calendar'] as const;
const CALENDARS_KEY = ['staff', 'calendar', 'calendars'] as const;
const SLOTS_KEY = ['staff', 'time-slots'] as const;

export const CONSENT_ERROR_MESSAGE = 'No pudimos conectar Google Calendar. Probá de nuevo.';

class InvalidConsentUrlError extends Error {}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function useCalendarStatus() {
  return useQuery({ queryKey: CALENDAR_KEY, queryFn: () => apiFetch<CalendarStatusDto>('/staff/calendar') });
}

export function useCalendarOptions(enabled: boolean) {
  return useQuery({
    queryKey: CALENDARS_KEY,
    queryFn: () => apiFetch<GoogleCalendarOptionDto[]>('/staff/calendar/calendars'),
    enabled,
  });
}

/**
 * Asks the API for the Google consent URL and sends the browser there, only if it is an https URL. `isSuccess` stays true
 * until the browser leaves the page, so the button cannot start a second consent.
 */
export function useConnectCalendar() {
  return useMutation({
    mutationFn: async () => {
      const { authUrl } = await apiFetch<{ authUrl: string }>('/staff/calendar/connect', { method: 'POST' });
      if (!isHttpsUrl(authUrl)) throw new InvalidConsentUrlError();
      return authUrl;
    },
    onSuccess: (authUrl) => window.location.assign(authUrl),
    onError: (error) => toast.error(error instanceof InvalidConsentUrlError ? CONSENT_ERROR_MESSAGE : errorMessage(error)),
  });
}

export function useSelectCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (calendarId: string) =>
      apiFetch<CalendarStatusDto>('/staff/calendar', { method: 'PATCH', body: { calendarId } }),
    onSuccess: (updated) => {
      queryClient.setQueryData(CALENDAR_KEY, updated);
      toast.success('Calendario guardado.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useSyncCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<CalendarStatusDto>('/staff/calendar/sync', { method: 'POST' }),
    onSuccess: (updated) => {
      queryClient.setQueryData(CALENDAR_KEY, updated);
      toast.success('Sincronizamos con Google Calendar.');
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: SLOTS_KEY }),
  });
}

export function useDisconnectCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<CalendarStatusDto>('/staff/calendar', { method: 'DELETE' }),
    onSuccess: (updated) => {
      queryClient.setQueryData(CALENDAR_KEY, updated);
      queryClient.removeQueries({ queryKey: CALENDARS_KEY });
      return queryClient.invalidateQueries({ queryKey: SLOTS_KEY });
    },
  });
}
