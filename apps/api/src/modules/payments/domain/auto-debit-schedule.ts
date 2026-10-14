import { AppError } from '../../../common/errors/app-error.js';
import { addDays, addMonths } from '../../../common/time/business-time.js';
import type { PlanKind } from '../../catalog/entities/plan.entity.js';
import type { AutoDebitFrequencyType, AutoDebitService } from '../entities/auto-debit.entity.js';

const PENDING_LIMIT_MS = 24 * 60 * 60_000;

export interface AutoDebitFrequency { frequency: number; frequencyType: AutoDebitFrequencyType }

// D96: a period plan is charged every `periodMonths` months, a session pack every `periodDays` days.
export function frequencyOf(plan: { kind: PlanKind; periodMonths: number | null; periodDays: number | null }): AutoDebitFrequency {
  if (plan.kind === 'period_plan' && plan.periodMonths) return { frequency: plan.periodMonths, frequencyType: 'months' };
  if (plan.kind === 'session_pack' && plan.periodDays) return { frequency: plan.periodDays, frequencyType: 'days' };
  throw new AppError('AUTO_DEBIT_NOT_ALLOWED');
}

// D96: with a Performance period still running, the first charge waits for the day after it ends, so a paid day is
// never charged twice. `null` = charge right away (no current period, or Recovery, whose packs start on payment).
export function firstChargeDate(service: AutoDebitService, latestPerformanceEndsOn: string | null, today: string): string | null {
  if (service !== 'performance' || latestPerformanceEndsOn === null || latestPerformanceEndsOn < today) return null;
  return addDays(latestPerformanceEndsOn, 1);
}

// A debit the client never authorized is abandoned after 24 h.
export function isPendingExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() > PENDING_LIMIT_MS;
}

// The charge after the one due on `chargeDate`.
export function nextChargeAfter(chargeDate: string, { frequency, frequencyType }: AutoDebitFrequency): string {
  return frequencyType === 'months' ? addMonths(chargeDate, frequency) : addDays(chargeDate, frequency);
}
