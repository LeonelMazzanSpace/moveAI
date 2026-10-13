import { SETTINGS_DEFAULTS } from '../../settings/settings.defaults.js';
import { evaluateClientAlerts, initials, shownPlan, toPerformanceInput } from './alert-rules.js';

const sub = (over: Record<string, unknown> = {}) => ({
  id: 'sub1', userId: 'u', planId: 'p', planName: 'Plan Mensual', service: 'performance' as const,
  startsOn: '2026-09-18', endsOn: '2026-10-18', sessionsTotal: null, sessionsUsed: 0, purchaseId: null, createdAt: new Date(), ...over,
});
const base = {
  today: '2026-10-12', settings: SETTINGS_DEFAULTS, paused: null,
  performance: { current: sub(), upcomingAfterCurrent: false, latest: sub(), hasLaterThanLatest: false },
  metrics: { lastAttendanceOn: '2026-10-08', recentFrequency: 2.5, baselineFrequency: 2.5 },
};
const types = (input: Parameters<typeof evaluateClientAlerts>[0]) => evaluateClientAlerts(input).map((a) => `${a.type}:${a.periodKey}`);

describe('evaluateClientAlerts', () => {
  it('flags plans expiring within 7 days unless renewed', () => {
    expect(types(base)).toEqual(['expiring:sub:sub1']);
    expect(types({ ...base, performance: { ...base.performance, upcomingAfterCurrent: true } })).toEqual([]);
  });

  it('flags one week without attendance and prolonged inactivity exclusively', () => {
    const farEnd = sub({ endsOn: '2026-12-31' });
    const perf = { current: farEnd, upcomingAfterCurrent: false, latest: farEnd, hasLaterThanLatest: false };
    expect(types({ ...base, performance: perf, metrics: { ...base.metrics, lastAttendanceOn: '2026-10-03' } })).toEqual(['no_attendance:since:2026-10-03']);
    expect(types({ ...base, performance: perf, metrics: { ...base.metrics, lastAttendanceOn: '2026-09-15' } })).toEqual(['prolonged_inactivity:since:2026-09-15']);
  });

  it('flags frequency drops by month', () => {
    const farEnd = sub({ endsOn: '2026-12-31' });
    const perf = { current: farEnd, upcomingAfterCurrent: false, latest: farEnd, hasLaterThanLatest: false };
    expect(types({ ...base, performance: perf, metrics: { lastAttendanceOn: '2026-10-11', recentFrequency: 1, baselineFrequency: 3 } }))
      .toEqual(['frequency_drop:month:2026-10']);
  });

  it('flags recently expired plans without renewal', () => {
    const ended = sub({ startsOn: '2026-09-02', endsOn: '2026-10-02' });
    expect(types({ ...base, performance: { current: null, upcomingAfterCurrent: false, latest: ended, hasLaterThanLatest: false } }))
      .toEqual(['expired:sub:sub1']);
  });

  it('only raises recontact for paused clients', () => {
    expect(types({ ...base, paused: { reasonId: 'r1', recontactOn: '2026-11-01' } })).toEqual([]);
    expect(types({ ...base, today: '2026-11-01', paused: { reasonId: 'r1', recontactOn: '2026-11-01' } })).toEqual(['recontact:reason:r1']);
  });
});

describe('evaluateClientAlerts — R12 edges', () => {
  const farEnd = sub({ endsOn: '2026-12-31' });
  const perf = { current: farEnd, upcomingAfterCurrent: false, latest: farEnd, hasLaterThanLatest: false };
  const withMetrics = (metrics: Partial<typeof base.metrics>, over: Partial<typeof base> = {}) =>
    ({ ...base, performance: perf, ...over, metrics: { ...base.metrics, ...metrics } });

  it('includes the expiry day and the threshold day, and excludes the day after the threshold', () => {
    const endsToday = sub({ endsOn: '2026-10-12' });
    const endsIn8 = sub({ endsOn: '2026-10-20' });
    const endsIn7 = sub({ endsOn: '2026-10-19' });
    const only = (s: ReturnType<typeof sub>) => ({ current: s, upcomingAfterCurrent: false, latest: s, hasLaterThanLatest: false });
    expect(types({ ...base, performance: only(endsToday) })).toEqual(['expiring:sub:sub1']);
    expect(types({ ...base, performance: only(endsIn7) })).toEqual(['expiring:sub:sub1']);
    expect(types({ ...base, performance: only(endsIn8) })).toEqual([]);
  });

  it('carries plan name and end date as expiring context', () => {
    expect(evaluateClientAlerts(base)).toEqual([
      { type: 'expiring', periodKey: 'sub:sub1', context: { planName: 'Plan Mensual', endsOn: '2026-10-18' } },
    ]);
  });

  it('counts inactivity from the plan start when there is no attendance', () => {
    const started = sub({ startsOn: '2026-10-02', endsOn: '2026-12-31' });
    const fromStart = { current: started, upcomingAfterCurrent: false, latest: started, hasLaterThanLatest: false };
    expect(evaluateClientAlerts({ ...base, performance: fromStart, metrics: { ...base.metrics, lastAttendanceOn: null } })).toEqual([
      { type: 'no_attendance', periodKey: 'since:2026-10-02', context: { lastAttendanceOn: null, days: 10 } },
    ]);
  });

  it('uses the configured thresholds with inclusive boundaries', () => {
    expect(types(withMetrics({ lastAttendanceOn: '2026-10-06' }))).toEqual([]);
    expect(types(withMetrics({ lastAttendanceOn: '2026-10-05' }))).toEqual(['no_attendance:since:2026-10-05']);
    expect(types(withMetrics({ lastAttendanceOn: '2026-09-22' }))).toEqual(['no_attendance:since:2026-09-22']);
    expect(types(withMetrics({ lastAttendanceOn: '2026-09-21' }))).toEqual(['prolonged_inactivity:since:2026-09-21']);
    const settings = { ...SETTINGS_DEFAULTS, noAttendanceDays: 3, prolongedInactivityDays: 5 };
    expect(types(withMetrics({ lastAttendanceOn: '2026-10-09' }, { settings }))).toEqual(['no_attendance:since:2026-10-09']);
    expect(types(withMetrics({ lastAttendanceOn: '2026-10-07' }, { settings }))).toEqual(['prolonged_inactivity:since:2026-10-07']);
  });

  it('skips frequency drops when an inactivity alert fired in the same run', () => {
    expect(types(withMetrics({ lastAttendanceOn: '2026-10-03', recentFrequency: 0, baselineFrequency: 3 })))
      .toEqual(['no_attendance:since:2026-10-03']);
  });

  it('requires a baseline of at least one per week and a drop below the ratio', () => {
    expect(types(withMetrics({ lastAttendanceOn: '2026-10-11', recentFrequency: 0, baselineFrequency: 0.875 }))).toEqual([]);
    expect(types(withMetrics({ lastAttendanceOn: '2026-10-11', recentFrequency: 0.5, baselineFrequency: 1 }))).toEqual([]);
    expect(evaluateClientAlerts(withMetrics({ lastAttendanceOn: '2026-10-11', recentFrequency: 0.5, baselineFrequency: 1.125 }))).toEqual([
      { type: 'frequency_drop', periodKey: 'month:2026-10', context: { recentFrequency: 0.5, baselineFrequency: 1.125 } },
    ]);
  });

  it('raises expiring and inactivity together when both apply', () => {
    expect(types({ ...base, metrics: { ...base.metrics, lastAttendanceOn: '2026-10-01' } }))
      .toEqual(['expiring:sub:sub1', 'no_attendance:since:2026-10-01']);
  });

  it('limits expired alerts to 1–30 days after the end and to plans without a later one', () => {
    const endedOn = (endsOn: string) => {
      const latest = sub({ startsOn: '2026-08-01', endsOn });
      return { current: null, upcomingAfterCurrent: false, latest, hasLaterThanLatest: false };
    };
    expect(types({ ...base, performance: endedOn('2026-10-11') })).toEqual(['expired:sub:sub1']);
    expect(types({ ...base, performance: endedOn('2026-09-12') })).toEqual(['expired:sub:sub1']);
    expect(types({ ...base, performance: endedOn('2026-09-11') })).toEqual([]);
    expect(types({ ...base, performance: { ...endedOn('2026-10-02'), hasLaterThanLatest: true } })).toEqual([]);
    expect(evaluateClientAlerts({ ...base, performance: endedOn('2026-10-02') })[0].context)
      .toEqual({ planName: 'Plan Mensual', endedOn: '2026-10-02' });
  });

  it('raises nothing for clients that never had a plan or only have a future one', () => {
    expect(types({ ...base, performance: { current: null, upcomingAfterCurrent: false, latest: null, hasLaterThanLatest: false } })).toEqual([]);
    const future = sub({ startsOn: '2026-10-20', endsOn: '2026-11-20' });
    expect(types({ ...base, performance: { current: null, upcomingAfterCurrent: false, latest: future, hasLaterThanLatest: false } })).toEqual([]);
  });

  it('keeps paused clients silent even when every other rule would fire, and without a recontact date', () => {
    const ended = sub({ startsOn: '2026-09-02', endsOn: '2026-10-02' });
    const expiredPerf = { current: null, upcomingAfterCurrent: false, latest: ended, hasLaterThanLatest: false };
    const quiet = { ...base, metrics: { lastAttendanceOn: '2026-09-01', recentFrequency: 0, baselineFrequency: 3 } };
    expect(types({ ...quiet, paused: { reasonId: 'r1', recontactOn: null } })).toEqual([]);
    expect(types({ ...quiet, performance: expiredPerf, paused: { reasonId: 'r1', recontactOn: null } })).toEqual([]);
    expect(evaluateClientAlerts({ ...quiet, today: '2026-11-05', paused: { reasonId: 'r1', recontactOn: '2026-11-01' } })).toEqual([
      { type: 'recontact', periodKey: 'reason:r1', context: { recontactOn: '2026-11-01' } },
    ]);
  });
});

describe('toPerformanceInput', () => {
  const current = sub({ id: 'cur', startsOn: '2026-09-18', endsOn: '2026-10-18' });
  const next = sub({ id: 'next', startsOn: '2026-10-19', endsOn: '2026-11-18' });
  const old = sub({ id: 'old', startsOn: '2026-07-01', endsOn: '2026-08-01' });

  it('flags a renewal after the current plan', () => {
    expect(toPerformanceInput([old, current], '2026-10-12')).toEqual({
      current, upcomingAfterCurrent: false, latest: current, hasLaterThanLatest: false,
    });
    expect(toPerformanceInput([current, next], '2026-10-12')).toEqual({
      current, upcomingAfterCurrent: true, latest: next, hasLaterThanLatest: false,
    });
  });

  it('describes clients without a current plan', () => {
    expect(toPerformanceInput([old], '2026-10-12')).toEqual({ current: null, upcomingAfterCurrent: false, latest: old, hasLaterThanLatest: false });
    expect(toPerformanceInput([], '2026-10-12')).toEqual({ current: null, upcomingAfterCurrent: false, latest: null, hasLaterThanLatest: false });
  });
});

describe('shownPlan and initials', () => {
  it('shows the current plan, else the latest one', () => {
    const current = sub({ id: 'cur' });
    const next = sub({ id: 'next', startsOn: '2026-10-19', endsOn: '2026-11-18' });
    expect(shownPlan([current, next], '2026-10-12')?.id).toBe('cur');
    expect(shownPlan([current], '2026-10-30')?.id).toBe('cur');
    expect(shownPlan([], '2026-10-30')).toBeNull();
  });

  it('takes the first letter of the first two words', () => {
    expect(initials('Martina Suárez')).toBe('MS');
    expect(initials('  ana  maría lópez ')).toBe('AM');
    expect(initials('Lucía')).toBe('L');
  });
});
