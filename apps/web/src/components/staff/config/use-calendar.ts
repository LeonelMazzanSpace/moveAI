'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { CalendarStatusDto, GoogleCalendarOptionDto } from '@/lib/api/types';

const CALENDAR_KEY = ['staff', 'calendar'] as const;
const CALENDARS_KEY = ['staff', 'calendar', 'calendars'] as const;
const SLOTS_KEY = ['staff', 'time-slots'] as const;

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

/** Asks the API for the Google consent URL and sends the browser there. */
export function useConnectCalendar() {
  return useMutation({
    mutationFn: () => apiFetch<{ authUrl: string }>('/staff/calendar/connect', { method: 'POST' }),
    onSuccess: ({ authUrl }) => window.location.assign(authUrl),
    onError: (error) => toast.error(errorMessage(error)),
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
