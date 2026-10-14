import { selectExpiryReminders } from './expiry-reminders.js';

const sub = (id: string, startsOn: string, endsOn: string) => ({
  id, userId: 'u', planId: 'p', planName: 'Plan Mensual', service: 'performance' as const, startsOn, endsOn,
  sessionsTotal: null, sessionsUsed: 0, purchaseId: null, createdAt: new Date(),
});

describe('selectExpiryReminders', () => {
  const today = '2026-10-12';
  it('selects expiring and recently expired plans, skipping paused and renewed clients', () => {
    const result = selectExpiryReminders({
      today, expiringSoonDays: 7,
      clients: [
        { userId: 'a', paused: false, current: sub('s1', '2026-09-18', '2026-10-18'), latest: sub('s1', '2026-09-18', '2026-10-18'), renewed: false, autoDebit: false },
        { userId: 'b', paused: true, current: sub('s2', '2026-09-18', '2026-10-18'), latest: sub('s2', '2026-09-18', '2026-10-18'), renewed: false, autoDebit: false },
        { userId: 'c', paused: false, current: null, latest: sub('s3', '2026-09-10', '2026-10-10'), renewed: false, autoDebit: false },
        { userId: 'd', paused: false, current: sub('s4', '2026-09-18', '2026-10-18'), latest: sub('s5', '2026-10-19', '2026-11-18'), renewed: true, autoDebit: false },
        { userId: 'e', paused: false, current: null, latest: sub('s6', '2026-08-01', '2026-09-01'), renewed: false, autoDebit: false },
      ],
    });
    expect(result.map((r) => `${r.userId}:${r.template}:${r.subscription.id}`)).toEqual(['a:plan-expiring:s1', 'c:plan-expired:s3']);
  });

  it('never reminds a paused client, not even about a plan that expired 1 to 3 days ago', () => {
    const ended = sub('s7', '2026-09-10', '2026-10-10');
    const result = selectExpiryReminders({
      today, expiringSoonDays: 7,
      clients: [{ userId: 'p', paused: true, current: null, latest: ended, renewed: false, autoDebit: false }],
    });
    expect(result).toEqual([]);
  });

  it('covers the window edges: expiring from today to expiringSoonDays, expired only 1 to 3 days after the end', () => {
    const pick = (current: ReturnType<typeof sub> | null, latest: ReturnType<typeof sub> | null) =>
      selectExpiryReminders({ today, expiringSoonDays: 7, clients: [{ userId: 'x', paused: false, current, latest, renewed: false, autoDebit: false }] })
        .map((r) => r.template);
    const ends = (endsOn: string) => sub('s', '2026-08-01', endsOn);

    expect(pick(ends('2026-10-12'), ends('2026-10-12'))).toEqual(['plan-expiring']);
    expect(pick(ends('2026-10-19'), ends('2026-10-19'))).toEqual(['plan-expiring']);
    expect(pick(ends('2026-10-20'), ends('2026-10-20'))).toEqual([]);
    expect(pick(null, ends('2026-10-11'))).toEqual(['plan-expired']);
    expect(pick(null, ends('2026-10-09'))).toEqual(['plan-expired']);
    expect(pick(null, ends('2026-10-08'))).toEqual([]);
    expect(pick(null, ends('2026-10-12'))).toEqual([]);
    expect(pick(null, null)).toEqual([]);
  });
});

describe('selectExpiryReminders with an automatic debit (D96)', () => {
  const today = '2026-10-12';
  const sub = (id: string, endsOn: string) => ({
    id, userId: 'u', planId: 'p', planName: 'Plan Mensual', service: 'performance' as const, startsOn: '2026-09-18', endsOn,
    sessionsTotal: null, sessionsUsed: 0, purchaseId: null, createdAt: new Date(),
  });

  it('does not warn an authorized Performance debit that its plan is expiring', () => {
    const current = sub('s1', '2026-10-15');
    const result = selectExpiryReminders({
      today, expiringSoonDays: 7,
      clients: [{ userId: 'a', paused: false, current, latest: current, renewed: false, autoDebit: true }],
    });
    expect(result).toEqual([]);
  });

  it('still tells it that the plan expired when the period was cut', () => {
    const ended = sub('s2', '2026-10-10');
    const result = selectExpiryReminders({
      today, expiringSoonDays: 7,
      clients: [{ userId: 'a', paused: false, current: null, latest: ended, renewed: false, autoDebit: true }],
    });
    expect(result.map((r) => r.template)).toEqual(['plan-expired']);
  });
});
