import type { FollowupContactChannel, FollowupContactOutcome } from '../entities/followup-contact.entity.js';
import type { AlertType } from './alert.model.js';

export type ContactChannel = FollowupContactChannel;
export type ContactOutcome = FollowupContactOutcome;

export const CONTACT_CHANNELS: ContactChannel[] = ['phone', 'whatsapp', 'email', 'in_person'];
export const CONTACT_OUTCOMES: ContactOutcome[] = ['reached', 'no_answer', 'left_message'];

export interface ContactDto {
  id: string;
  channel: ContactChannel;
  outcome: ContactOutcome;
  note: string | null;
  staffName: string;
  alertType: AlertType | null;
  createdAt: string;
}
