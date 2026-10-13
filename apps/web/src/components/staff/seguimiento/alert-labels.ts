import type { AlertDto, AlertType, ContactChannel, ContactOutcome, InactivityReasonCode } from '@/lib/api/types';

export const ALERT_LABEL: Record<AlertType, string> = {
  expiring: 'Por vencer',
  expired: 'Vencidos sin renovar',
  no_attendance: '1 semana sin asistir',
  prolonged_inactivity: 'Inactividad prolongada',
  frequency_drop: 'Baja de frecuencia',
  recontact: 'Re-contactar',
  checkin_pain: 'Molestia reportada',
  checkin_goals: 'Cambio de objetivos',
};

export const ALERT_ORDER = Object.keys(ALERT_LABEL) as AlertType[];

export function isAlertType(value: string | null): value is AlertType {
  return value !== null && value in ALERT_LABEL;
}

export const REASON_LABEL: Record<InactivityReasonCode, string> = {
  injury: 'Lesión',
  vacation: 'Vacaciones',
  temporary_pause: 'Pausa temporal',
  no_time: 'Falta de tiempo',
  moving: 'Mudanza',
  return_later: 'Quiere volver más adelante',
};

export const REASON_ORDER = Object.keys(REASON_LABEL) as InactivityReasonCode[];

export const PAUSE_LABEL: Record<InactivityReasonCode, string> = {
  injury: 'Pausa por lesión',
  vacation: 'Pausa por vacaciones',
  temporary_pause: 'Pausa temporal',
  no_time: 'Pausa por falta de tiempo',
  moving: 'Pausa por mudanza',
  return_later: 'Pausa: quiere volver más adelante',
};

export const CHANNEL_LABEL: Record<ContactChannel, string> = {
  phone: 'Teléfono',
  whatsapp: 'WhatsApp',
  email: 'Email',
  in_person: 'En persona',
};

export const OUTCOME_LABEL: Record<ContactOutcome, string> = {
  reached: 'Habló con la persona',
  no_answer: 'No respondió',
  left_message: 'Dejé un mensaje',
};

const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/** Días de calendario desde `today` hasta `date` (ambos `YYYY-MM-DD`); negativo si ya pasó. */
export function daysUntil(today: string, date: string): number {
  return dayNumber(date) - dayNumber(today);
}

export function expiringLabel(alert: AlertDto, today: string): string {
  if (!alert.endsOn) return 'Plan por vencer';
  const days = daysUntil(today, alert.endsOn);
  if (days <= 0) return 'Plan vence hoy';
  return days === 1 ? 'Plan vence en 1 día' : `Plan vence en ${days} días`;
}
