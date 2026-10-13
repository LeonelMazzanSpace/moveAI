import type { InactivityReasonCode } from '@/lib/api/types';

export const INACTIVITY_REASON_LABEL: Record<InactivityReasonCode, string> = {
  injury: 'Lesión',
  vacation: 'Vacaciones',
  temporary_pause: 'Pausa temporal',
  no_time: 'Falta de tiempo',
  moving: 'Mudanza',
  return_later: 'Quiere volver más adelante',
};

export const INACTIVITY_REASON_CODES = Object.keys(INACTIVITY_REASON_LABEL) as InactivityReasonCode[];
