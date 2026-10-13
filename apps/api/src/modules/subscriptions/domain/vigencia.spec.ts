import { AppError } from '../../../common/errors/app-error.js';
import { computeActivationPeriod, covers, performanceSummary, toPackDto, toSubscriptionDto } from './vigencia.js';

const monthly = { id: 'p1', name: 'Plan Mensual', service: 'performance' as const, kind: 'period_plan' as const, periodMonths: 1, periodDays: null, sessionsIncluded: null };
const quarterly = { ...monthly, id: 'p3', name: 'Plan Trimestral', periodMonths: 3 };
const pack4 = { id: 'r4', name: 'Paquete 4 sesiones', service: 'recovery' as const, kind: 'session_pack' as const, periodMonths: null, periodDays: 30, sessionsIncluded: 4 };

describe('computeActivationPeriod', () => {
  it('starts today on first purchase', () => {
    expect(computeActivationPeriod(quarterly, null, '2026-08-15')).toEqual({ startsOn: '2026-08-15', endsOn: '2026-11-15', sessionsTotal: null });
  });
  it('extends from the current end when renewing early', () => {
    expect(computeActivationPeriod(monthly, '2026-11-15', '2026-11-10')).toEqual({ startsOn: '2026-11-16', endsOn: '2026-12-15', sessionsTotal: null });
  });
  it('restarts today after expiry', () => {
    expect(computeActivationPeriod(monthly, '2026-10-02', '2026-10-12')).toEqual({ startsOn: '2026-10-12', endsOn: '2026-11-12', sessionsTotal: null });
  });
  it('gives packs 30 days and their sessions', () => {
    expect(computeActivationPeriod(pack4, null, '2026-10-01')).toEqual({ startsOn: '2026-10-01', endsOn: '2026-10-30', sessionsTotal: 4 });
  });
});

describe('covers and DTO', () => {
  const sub = { id: 's', userId: 'u', planId: 'p3', planName: 'Plan Trimestral', service: 'performance' as const, startsOn: '2026-08-15', endsOn: '2026-11-15', sessionsTotal: null, sessionsUsed: 0, purchaseId: null, createdAt: new Date() };
  it('covers the whole last day', () => {
    expect(covers(sub, '2026-11-15')).toBe(true);
    expect(covers(sub, '2026-11-16')).toBe(false);
  });
  it('matches the profile mockup numbers', () => {
    expect(toSubscriptionDto(sub, '2026-10-12', 7)).toMatchObject({ status: 'active', daysLeft: 34, progressPct: 63 });
    expect(toSubscriptionDto(sub, '2026-11-10', 7).status).toBe('expiring');
  });
});

describe('edge cases', () => {
  const base = { userId: 'u', planId: 'p1', planName: 'Plan Mensual', service: 'performance' as const, sessionsTotal: null, sessionsUsed: 0, purchaseId: null, createdAt: new Date() };
  const past = { ...base, id: 'past', startsOn: '2026-08-01', endsOn: '2026-09-01' };
  const current = { ...base, id: 'current', startsOn: '2026-09-15', endsOn: '2026-10-15' };
  const next = { ...base, id: 'next', startsOn: '2026-10-16', endsOn: '2026-11-15' };
  const pack = { ...base, id: 'pack', service: 'recovery' as const, planName: 'Paquete 4 sesiones', startsOn: '2026-10-01', endsOn: '2026-10-30', sessionsTotal: 4, sessionsUsed: 3 };
  const monthly = { id: 'p1', name: 'Plan Mensual', service: 'performance' as const, kind: 'period_plan' as const, periodMonths: 1, periodDays: null, sessionsIncluded: null };

  it('renews on the last day of the current plan without losing it', () => {
    expect(computeActivationPeriod(monthly, '2026-10-12', '2026-10-12')).toEqual({ startsOn: '2026-10-13', endsOn: '2026-11-12', sessionsTotal: null });
  });

  it('rejects kinds that do not create subscriptions', () => {
    const evaluation = { id: 'e', name: 'Evaluación', service: 'rehab' as const, kind: 'evaluation' as const, periodMonths: null, periodDays: null, sessionsIncluded: null };
    const run = () => computeActivationPeriod(evaluation, null, '2026-10-12');
    expect(run).toThrow(AppError);
    expect(run).toThrow(expect.objectContaining({ code: 'PLAN_KIND_INVALID' }));
  });

  it('summarizes current, upcoming and latest Performance subscriptions', () => {
    expect(performanceSummary([past, current, next, pack], '2026-10-12')).toEqual({ current, upcoming: next, latest: next });
    expect(performanceSummary([past, pack], '2026-10-12')).toEqual({ current: null, upcoming: null, latest: past });
    expect(performanceSummary([pack], '2026-10-12')).toEqual({ current: null, upcoming: null, latest: null });
  });

  it('marks scheduled and expired subscriptions', () => {
    expect(toSubscriptionDto(next, '2026-10-12', 7)).toMatchObject({ status: 'scheduled', progressPct: 0, daysLeft: 34 });
    expect(toSubscriptionDto(past, '2026-10-12', 7)).toMatchObject({ status: 'expired', progressPct: 100, daysLeft: 0 });
    expect(toSubscriptionDto(current, '2026-10-15', 7)).toMatchObject({ status: 'expiring', daysLeft: 0, progressPct: 100 });
  });

  it('exposes the pack balance', () => {
    expect(toPackDto(pack)).toEqual({ id: 'pack', planId: 'p1', planName: 'Paquete 4 sesiones', startsOn: '2026-10-01', endsOn: '2026-10-30', sessionsTotal: 4, sessionsUsed: 3, sessionsLeft: 1 });
  });
});
