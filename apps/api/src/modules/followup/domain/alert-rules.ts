import { businessMonth, diffDays } from '../../../common/time/business-time.js';
import type { SettingsValues } from '../../settings/models/settings.model.js';
import { performanceSummary } from '../../subscriptions/domain/vigencia.js';
import type { SubscriptionModel } from '../../subscriptions/models/subscription.model.js';
import type { AlertCandidate } from '../models/alert.model.js';

const EXPIRED_ALERT_MAX_DAYS = 30;

export interface ClientAlertsInput {
  today: string;
  settings: SettingsValues;
  paused: { reasonId: string; recontactOn: string | null } | null;
  performance: {
    current: SubscriptionModel | null;
    upcomingAfterCurrent: boolean;
    latest: SubscriptionModel | null;
    hasLaterThanLatest: boolean;
  };
  metrics: { lastAttendanceOn: string | null; recentFrequency: number; baselineFrequency: number };
}

type ActiveInput = ClientAlertsInput & { performance: { current: SubscriptionModel } };

// D11: a paused client only gets the recontact alert, once its date arrives.
function pausedAlerts(today: string, paused: NonNullable<ClientAlertsInput['paused']>): AlertCandidate[] {
  if (paused.recontactOn === null || paused.recontactOn > today) return [];
  return [{ type: 'recontact', periodKey: `reason:${paused.reasonId}`, context: { recontactOn: paused.recontactOn } }];
}

function expiringAlert({ today, settings, performance }: ActiveInput): AlertCandidate | null {
  const { current, upcomingAfterCurrent } = performance;
  const daysLeft = diffDays(today, current.endsOn);
  if (upcomingAfterCurrent || daysLeft < 0 || daysLeft > settings.expiringSoonDays) return null;
  return { type: 'expiring', periodKey: `sub:${current.id}`, context: { planName: current.planName, endsOn: current.endsOn } };
}

// `prolonged_inactivity` takes precedence over `no_attendance`; both share the period key of the reference date.
function inactivityAlert({ today, settings, performance, metrics }: ActiveInput): AlertCandidate | null {
  const ref = metrics.lastAttendanceOn ?? performance.current.startsOn;
  const days = diffDays(ref, today);
  const context = { lastAttendanceOn: metrics.lastAttendanceOn, days };
  if (days >= settings.prolongedInactivityDays) return { type: 'prolonged_inactivity', periodKey: `since:${ref}`, context };
  if (days >= settings.noAttendanceDays) return { type: 'no_attendance', periodKey: `since:${ref}`, context };
  return null;
}

function frequencyDropAlert({ today, settings, metrics }: ActiveInput): AlertCandidate | null {
  const { recentFrequency, baselineFrequency } = metrics;
  if (baselineFrequency < 1 || recentFrequency >= settings.frequencyDropRatio * baselineFrequency) return null;
  return { type: 'frequency_drop', periodKey: `month:${businessMonth(today)}`, context: { recentFrequency, baselineFrequency } };
}

function expiredAlert({ today, performance }: ClientAlertsInput): AlertCandidate | null {
  const { latest, hasLaterThanLatest } = performance;
  if (!latest || hasLaterThanLatest) return null;
  const daysSinceEnd = diffDays(latest.endsOn, today);
  if (daysSinceEnd < 1 || daysSinceEnd > EXPIRED_ALERT_MAX_DAYS) return null;
  return { type: 'expired', periodKey: `sub:${latest.id}`, context: { planName: latest.planName, endedOn: latest.endsOn } };
}

const isActive = (input: ClientAlertsInput): input is ActiveInput => input.performance.current !== null;

// R12, for one client. Check-in alerts are created when the client answers, not here.
export function evaluateClientAlerts(input: ClientAlertsInput): AlertCandidate[] {
  if (input.paused) return pausedAlerts(input.today, input.paused);
  if (!isActive(input)) {
    const expired = expiredAlert(input);
    return expired ? [expired] : [];
  }
  const inactivity = inactivityAlert(input);
  const candidates = [expiringAlert(input), inactivity, inactivity ? null : frequencyDropAlert(input)];
  return candidates.filter((candidate): candidate is AlertCandidate => candidate !== null);
}

// Builds the R12 `performance` input from a client's non-deleted Performance subscriptions.
export function toPerformanceInput(subs: SubscriptionModel[], today: string): ClientAlertsInput['performance'] {
  const { current, latest } = performanceSummary(subs, today);
  return {
    current,
    upcomingAfterCurrent: current !== null && subs.some((sub) => sub.startsOn > current.endsOn),
    latest,
    hasLaterThanLatest: latest !== null && subs.some((sub) => sub.startsOn > latest.endsOn),
  };
}

// Plan shown next to an alert or check-in: the current one, else the latest (e.g. the plan that just expired).
export function shownPlan(subs: SubscriptionModel[], today: string): SubscriptionModel | null {
  const { current, latest } = performanceSummary(subs, today);
  return current ?? latest;
}

// R15: first letter of the first two words, upper-cased.
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}
