'use client';

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useState } from 'react';
import { mondayOf } from '@/components/booking/week-selector';
import { useBusinessToday } from '@/components/booking/day-selector';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type {
  AutoDebitCheckoutDto,
  AvailabilityDayDto,
  CheckoutResponseDto,
  MeDto,
  PublicSettingsDto,
  Service,
  TimeSlotDto,
} from '@/lib/api/types';
import { addDaysWeb } from '@/lib/format';
import type { GuestValues } from './guest-form.schema';

const WEEK_DAYS = 7;

export const POLL_INTERVAL_MS = 3000;
export const MAX_POLL_ATTEMPTS = 20;

function redirectToPayment({ initPoint }: { initPoint: string }): void {
  window.location.assign(initPoint);
}

/** Cada consulta cuenta, salga bien o mal: así los errores persistentes también terminan el polling. */
function attemptsOf(state: { dataUpdateCount: number; errorUpdateCount: number } | undefined): number {
  return state ? state.dataUpdateCount + state.errorUpdateCount : 0;
}

interface PolledStatusOptions<T> {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  /** Mientras devuelva `true` se vuelve a consultar cada 3 s, hasta `MAX_POLL_ATTEMPTS` consultas. */
  isPending: (data: T) => boolean;
}

/** Consulta un estado que cambia solo (pago o débito) con tope de intentos que cuenta éxitos y errores. */
export function usePolledStatus<T>({ queryKey, queryFn, isPending }: PolledStatusOptions<T>) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn,
    retry: false,
    staleTime: 0,
    refetchInterval: (current) =>
      current.state.data !== undefined && isPending(current.state.data) && attemptsOf(current.state) < MAX_POLL_ATTEMPTS
        ? POLL_INTERVAL_MS
        : false,
  });
  // Leer estas marcas suscribe el render a cada respuesta o error, aunque `data` sea idéntico (structural sharing);
  // sin eso el último intento no vuelve a renderizar y `attempts` queda viejo.
  void query.dataUpdatedAt;
  void query.errorUpdatedAt;
  return { query, attempts: attemptsOf(queryClient.getQueryState(queryKey)) };
}

/**
 * Usuario en sesión, o `null` si es un visitante. Solo un 401 es un visitante: cualquier otro
 * error se devuelve en `error` para no pedirle los datos de invitado a alguien con sesión.
 * Si ya hay un usuario cargado, un error al refrescarlo no cuenta: el flujo sigue con el último dato conocido.
 */
export function useMe() {
  const query = useQuery({ queryKey: ['me'], queryFn: () => apiFetch<MeDto>('/me'), retry: false });
  const isGuest = query.error instanceof ApiError && query.error.status === 401;
  return {
    me: query.data ?? null,
    isPending: query.isPending,
    isGuest,
    error: isGuest || query.data ? null : query.error,
    refetch: query.refetch,
  };
}

interface BookingCheckoutInput {
  planId: string;
  timeSlotId: string;
  guest?: GuestValues;
}

export function useBookingCheckout() {
  return useMutation({
    mutationFn: (input: BookingCheckoutInput) =>
      apiFetch<CheckoutResponseDto>('/checkout/booking', { method: 'POST', body: input }),
    onSuccess: redirectToPayment,
  });
}

export function usePlanCheckout() {
  return useMutation({
    mutationFn: (planId: string) => apiFetch<CheckoutResponseDto>('/checkout/plan', { method: 'POST', body: { planId } }),
    onSuccess: redirectToPayment,
  });
}

export function useAutoDebitCheckout() {
  return useMutation({
    mutationFn: (planSlug: string) =>
      apiFetch<AutoDebitCheckoutDto>('/checkout/auto-debit', { method: 'POST', body: { planSlug } }),
    onSuccess: redirectToPayment,
  });
}

export function useSlotPicker(service: Service) {
  const queryClient = useQueryClient();
  const today = useBusinessToday();
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: () => apiFetch<PublicSettingsDto>('/settings/public'),
  });
  const week = weekStart ?? (today ? mondayOf(today) : null);
  const availability = useQuery({
    queryKey: ['availability', service, week],
    queryFn: () =>
      apiFetch<AvailabilityDayDto[]>('/schedule/availability', { query: { service, from: week ?? '', days: WEEK_DAYS } }),
    enabled: week !== null,
  });
  const slots = useQuery({
    queryKey: ['time-slots', service, date],
    queryFn: () => apiFetch<TimeSlotDto[]>('/schedule/time-slots', { query: { service, date: date ?? '' } }),
    enabled: date !== null,
  });

  const bookingWindowDays = settings.data?.bookingWindowDays;

  return {
    today,
    week,
    date,
    slotId,
    slot: slots.data?.find((candidate) => candidate.id === slotId) ?? null,
    maxDate: today && bookingWindowDays !== undefined ? addDaysWeb(today, bookingWindowDays) : null,
    settings,
    availability,
    slots,
    selectDate: (next: string) => {
      setDate(next);
      setSlotId(null);
    },
    selectSlot: setSlotId,
    shiftWeek: setWeekStart,
    clearSlot: () => setSlotId(null),
    refresh: () => {
      setSlotId(null);
      void queryClient.invalidateQueries({ queryKey: ['time-slots', service] });
      void queryClient.invalidateQueries({ queryKey: ['availability', service] });
    },
  };
}

export type SlotPickerState = ReturnType<typeof useSlotPicker>;
