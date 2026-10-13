import type { InactivityReasonCode } from '../entities/inactivity-reason.entity.js';

export type { InactivityReasonCode };

export const INACTIVITY_REASON_CODES: InactivityReasonCode[] = [
  'injury', 'vacation', 'temporary_pause', 'no_time', 'moving', 'return_later',
];

export interface InactivityReasonDto {
  id: string;
  reason: InactivityReasonCode;
  note: string | null;
  recontactOn: string | null;
  startedAt: string;
  endedAt: string | null;
  createdByName: string;
}
