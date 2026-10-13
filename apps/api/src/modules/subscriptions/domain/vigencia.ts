import { AppError } from '../../../common/errors/app-error.js';
import { addDays, addMonths, diffDays } from '../../../common/time/business-time.js';
import type { PlanSnapshot, SubscriptionDto, SubscriptionModel, PackDto } from '../models/subscription.model.js';

export interface ActivationPeriod { startsOn: string; endsOn: string; sessionsTotal: number | null }

export interface PerformanceSummary {
  current: SubscriptionModel | null;
  upcoming: SubscriptionModel | null;
  latest: SubscriptionModel | null;
}

// R3: renewing before expiry starts the day after the current end, so no paid day is lost.
export function computeActivationPeriod(
  plan: PlanSnapshot,
  latestPerformanceEndsOn: string | null,
  today: string,
): ActivationPeriod {
  if (plan.kind === 'period_plan' && plan.periodMonths) {
    if (latestPerformanceEndsOn !== null && latestPerformanceEndsOn >= today) {
      return {
        startsOn: addDays(latestPerformanceEndsOn, 1),
        endsOn: addMonths(latestPerformanceEndsOn, plan.periodMonths),
        sessionsTotal: null,
      };
    }
    return { startsOn: today, endsOn: addMonths(today, plan.periodMonths), sessionsTotal: null };
  }
  if (plan.kind === 'session_pack' && plan.periodDays && plan.sessionsIncluded) {
    return { startsOn: today, endsOn: addDays(today, plan.periodDays - 1), sessionsTotal: plan.sessionsIncluded };
  }
  throw new AppError('PLAN_KIND_INVALID');
}

// R2: business dates compare lexicographically; the end date is covered until its last local minute.
export function covers(sub: Pick<SubscriptionModel, 'startsOn' | 'endsOn'>, date: string): boolean {
  return sub.startsOn <= date && date <= sub.endsOn;
}

// R4: expects non-deleted subscriptions; ignores other services.
export function performanceSummary(subs: SubscriptionModel[], today: string): PerformanceSummary {
  const performance = subs.filter((sub) => sub.service === 'performance');
  const current = performance.find((sub) => covers(sub, today)) ?? null;
  const upcoming = performance
    .filter((sub) => sub.startsOn > today)
    .reduce<SubscriptionModel | null>((best, sub) => (best === null || sub.startsOn < best.startsOn ? sub : best), null);
  const latest = performance.reduce<SubscriptionModel | null>(
    (best, sub) => (best === null || sub.endsOn > best.endsOn ? sub : best),
    null,
  );
  return { current, upcoming, latest };
}

function statusOf(sub: SubscriptionModel, today: string, expiringSoonDays: number): SubscriptionDto['status'] {
  if (covers(sub, today)) return diffDays(today, sub.endsOn) <= expiringSoonDays ? 'expiring' : 'active';
  return sub.startsOn > today ? 'scheduled' : 'expired';
}

function progressOf(sub: SubscriptionModel, today: string): number {
  const total = diffDays(sub.startsOn, sub.endsOn);
  if (total <= 0) return today >= sub.startsOn ? 100 : 0;
  const pct = Math.round((100 * diffDays(sub.startsOn, today)) / total);
  return Math.min(100, Math.max(0, pct));
}

export function toSubscriptionDto(sub: SubscriptionModel, today: string, expiringSoonDays: number): SubscriptionDto {
  return {
    id: sub.id,
    planId: sub.planId,
    planName: sub.planName,
    service: 'performance',
    startsOn: sub.startsOn,
    endsOn: sub.endsOn,
    status: statusOf(sub, today, expiringSoonDays),
    daysLeft: Math.max(0, diffDays(today, sub.endsOn)),
    progressPct: progressOf(sub, today),
  };
}

export function toPackDto(sub: SubscriptionModel): PackDto {
  const sessionsTotal = sub.sessionsTotal ?? 0;
  return {
    id: sub.id,
    planId: sub.planId,
    planName: sub.planName,
    startsOn: sub.startsOn,
    endsOn: sub.endsOn,
    sessionsTotal,
    sessionsUsed: sub.sessionsUsed,
    sessionsLeft: Math.max(0, sessionsTotal - sub.sessionsUsed),
  };
}
