'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type { AutoDebitCancelReason, AutoDebitDto, AutoDebitFrequencyType } from '@/lib/api/types';

export const CANCEL_REASON_LABEL: Record<AutoDebitCancelReason, string> = {
  client: 'Lo canceló el cliente',
  staff: 'Lo canceló el staff',
  provider: 'Lo canceló Mercado Pago',
  expired: 'Venció sin autorizarse',
};

const PROVIDER_CANCEL_MESSAGE = 'No pudimos cancelar el débito en Mercado Pago. Sigue activo: probá de nuevo en unos minutos.';

export function useMyAutoDebits({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['me', 'auto-debits'],
    queryFn: () => apiFetch<AutoDebitDto[]>('/me/auto-debits'),
    enabled,
  });
}

/** Un débito sigue vigente mientras espera la autorización o está autorizado. */
export function isActiveAutoDebit({ status }: AutoDebitDto): boolean {
  return status === 'pending' || status === 'authorized';
}

/** "cada mes", "cada 3 meses", "cada día", "cada 30 días". */
export function frequencyLabel(frequency: number, type: AutoDebitFrequencyType): string {
  if (type === 'months') return frequency === 1 ? 'cada mes' : `cada ${frequency} meses`;
  return frequency === 1 ? 'cada día' : `cada ${frequency} días`;
}

/** Si Mercado Pago falla al cancelar el débito sigue activo: el mensaje genérico de pago no aplica. */
export function cancelErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.code === 'PAYMENT_PROVIDER_ERROR' ? PROVIDER_CANCEL_MESSAGE : errorMessage(error);
}

export function useCancelAutoDebit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (autoDebitId: string) =>
      apiFetch<AutoDebitDto>(`/me/auto-debits/${encodeURIComponent(autoDebitId)}/cancel`, { method: 'POST' }),
    onSuccess: () => toast.success('Débito automático cancelado'),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['me', 'auto-debits'] }),
        queryClient.invalidateQueries({ queryKey: ['me', 'subscriptions'] }),
      ]),
  });
}
