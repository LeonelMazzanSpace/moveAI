import { diffDays } from '../../../common/time/business-time.js';
import type { SettingsValues } from '../../settings/models/settings.model.js';
import type { SubscriptionModel } from '../../subscriptions/models/subscription.model.js';
import type { ClientStatus, PaymentStatusSummary } from '../dto/client-responses.js';

export interface ClientStatusInput {
  today: string;
  settings: SettingsValues;
  paused: boolean;
  performance: { current: SubscriptionModel | null; latest: SubscriptionModel | null };
  lastAttendanceOn: string | null;
}

// R11: covered today → up to date; covered earlier only → overdue; never covered → none.
function paymentStatusOf({ current, latest }: ClientStatusInput['performance']): PaymentStatusSummary {
  if (current) return 'up_to_date';
  return latest ? 'overdue' : 'none';
}

function statusOf(input: ClientStatusInput): ClientStatus {
  const { today, settings, paused, performance, lastAttendanceOn } = input;
  const { current, latest } = performance;
  if (paused) return 'paused';
  if (latest === null) return 'no_plan';
  if (current === null) return 'expired';
  if (diffDays(today, current.endsOn) <= settings.expiringSoonDays) return 'expiring';
  if (diffDays(lastAttendanceOn ?? current.startsOn, today) >= settings.noAttendanceDays) return 'inactive';
  return 'active';
}

// R11: derived, never stored. Precedence: paused, no plan, expired, expiring, inactive, active.
export function deriveClientStatus(input: ClientStatusInput): { status: ClientStatus; paymentStatus: PaymentStatusSummary } {
  return { status: statusOf(input), paymentStatus: paymentStatusOf(input.performance) };
}
