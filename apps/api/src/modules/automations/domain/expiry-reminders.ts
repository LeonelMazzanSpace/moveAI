import { diffDays } from '../../../common/time/business-time.js';
import type { SubscriptionModel } from '../../subscriptions/models/subscription.model.js';

const EXPIRED_REMINDER_MAX_DAYS = 3;

export interface ExpiryReminderClient {
  userId: string;
  paused: boolean;
  current: SubscriptionModel | null;
  latest: SubscriptionModel | null;
  renewed: boolean;
  // D96: an authorized Performance automatic debit renews the plan by itself.
  autoDebit: boolean;
}

export interface ExpiryReminder {
  userId: string;
  template: 'plan-expiring' | 'plan-expired';
  subscription: SubscriptionModel;
}

function reminderFor(
  { today, expiringSoonDays }: { today: string; expiringSoonDays: number },
  client: ExpiryReminderClient,
): ExpiryReminder | null {
  const { userId, current, latest } = client;
  if (client.paused || client.renewed) return null;
  if (current) {
    if (client.autoDebit || diffDays(today, current.endsOn) > expiringSoonDays) return null;
    return { userId, template: 'plan-expiring', subscription: current };
  }
  if (!latest) return null;
  const daysSinceEnd = diffDays(latest.endsOn, today);
  if (daysSinceEnd < 1 || daysSinceEnd > EXPIRED_REMINDER_MAX_DAYS) return null;
  return { userId, template: 'plan-expired', subscription: latest };
}

// R14: paused clients (D11) and clients with a later renewal get no reminder; an authorized Performance debit (D96)
// skips `plan-expiring` but still gets `plan-expired` if the period was cut.
export function selectExpiryReminders(input: {
  today: string;
  expiringSoonDays: number;
  clients: ExpiryReminderClient[];
}): ExpiryReminder[] {
  return input.clients
    .map((client) => reminderFor(input, client))
    .filter((reminder): reminder is ExpiryReminder => reminder !== null);
}

// Email params show business dates as DD/MM/YYYY.
export function formatEmailDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}
