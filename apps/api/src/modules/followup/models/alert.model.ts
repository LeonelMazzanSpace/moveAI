import type { FollowupAlertStatus, FollowupAlertType } from '../entities/followup-alert.entity.js';
import type { InactivityReasonCode } from '../entities/inactivity-reason.entity.js';

export type AlertType = FollowupAlertType;
export type AlertStatus = FollowupAlertStatus;

export const ALERT_TYPES: AlertType[] = [
  'expiring', 'expired', 'no_attendance', 'prolonged_inactivity', 'frequency_drop', 'recontact', 'checkin_pain', 'checkin_goals',
];
export const ALERT_STATUSES: AlertStatus[] = ['open', 'handled'];

// R12: one alert per (client, type, period key).
export interface AlertCandidate {
  type: AlertType;
  periodKey: string;
  context: Record<string, unknown>;
}

// Response shapes of the HTTP contract.

export type AlertCountsDto = Record<AlertType, number> & { total: number };

export interface AlertDto {
  id: string;
  type: AlertType;
  status: AlertStatus;
  client: { id: string; name: string; initials: string };
  planName: string | null;
  endsOn: string | null;
  lastAttendanceOn: string | null;
  frequencyPerWeek: number;
  usualFrequencyPerWeek: number | null;
  contactsCount: number;
  pause: { reason: InactivityReasonCode; since: string; recontactOn: string | null } | null;
  checkin: { id: string; painDetail: string | null; goalsDetail: string | null } | null;
  createdAt: string;
}
