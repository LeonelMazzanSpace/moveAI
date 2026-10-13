import type { PackDto, SubscriptionDto } from '../../subscriptions/models/subscription.model.js';
import { buildNotices, packLowTitle } from './notices.js';

const subscription = (overrides: Partial<SubscriptionDto>): SubscriptionDto => ({
  id: 'sub-1', planId: 'p', planName: 'Plan Mensual', service: 'performance', startsOn: '2026-09-15', endsOn: '2026-10-18',
  status: 'expiring', daysLeft: 6, progressPct: 80, ...overrides,
});
const pack = (id: string, sessionsLeft: number): PackDto => ({
  id, planId: 'p', planName: 'Paquete 4', startsOn: '2026-10-01', endsOn: '2026-10-30', sessionsTotal: 4, sessionsUsed: 4 - sessionsLeft, sessionsLeft,
});
const base = { today: '2026-10-12', subscription: null, pendingCheckin: null, lastAnswered: null, packs: [] };

describe('buildNotices', () => {
  it('returns nothing when there is nothing to tell', () => {
    expect(buildNotices(base)).toEqual([]);
    expect(buildNotices({ ...base, subscription: subscription({ status: 'active', daysLeft: 30 }) })).toEqual([]);
    expect(buildNotices({ ...base, subscription: subscription({ status: 'scheduled' }) })).toEqual([]);
  });

  it('warns about an expiring plan with the days left', () => {
    const [notice] = buildNotices({ ...base, subscription: subscription({}) });
    expect(notice).toEqual({
      id: 'plan_expiring:sub-1', kind: 'plan_expiring', title: 'Tu plan vence en 6 días',
      body: 'Renová para no perder tus reservas.', actionUrl: '/planes?service=performance',
    });
  });

  it('uses the singular for a single day left', () => {
    const [notice] = buildNotices({ ...base, subscription: subscription({ daysLeft: 1 }) });
    expect(notice.title).toBe('Tu plan vence en 1 día');
  });

  it('flags an expired plan', () => {
    const [notice] = buildNotices({ ...base, subscription: subscription({ status: 'expired', daysLeft: 0 }) });
    expect(notice).toMatchObject({ id: 'plan_expired:sub-1', kind: 'plan_expired', title: 'Tu plan venció', actionUrl: '/planes?service=performance' });
  });

  it('shows the pending check-in and the check-in answered in the last 30 days', () => {
    const notices = buildNotices({
      ...base,
      pendingCheckin: { id: 'c-1', period: '2026-10', firstName: 'Martina' },
      lastAnswered: { period: '2026-10', respondedAt: new Date('2026-10-05T15:00:00.000Z') },
    });
    expect(notices.map((n) => n.kind)).toEqual(['checkin_pending', 'checkin_answered']);
    expect(notices[0]).toMatchObject({ id: 'checkin_pending:c-1', title: 'Tenés un check-in pendiente', actionUrl: '/check-in' });
    expect(notices[1]).toMatchObject({ title: 'Check-in de octubre respondido', actionUrl: null });
  });

  it('drops an answered check-in older than 30 days, using the Montevideo date', () => {
    const answered = (respondedAt: string) => buildNotices({ ...base, lastAnswered: { period: '2026-09', respondedAt: new Date(respondedAt) } });
    expect(answered('2026-09-12T12:00:00.000Z')).toHaveLength(1);
    expect(answered('2026-09-11T12:00:00.000Z')).toHaveLength(0);
    // 02:00 UTC on the 12th is still the 11th in Montevideo.
    expect(answered('2026-09-12T02:00:00.000Z')).toHaveLength(0);
  });

  it('warns about every pack with one session left or none', () => {
    const notices = buildNotices({ ...base, packs: [pack('k1', 1), pack('k2', 3), pack('k3', 0)] });
    expect(notices).toEqual([
      expect.objectContaining({ id: 'pack_low:k1', kind: 'pack_low', title: 'Te queda 1 sesión de Recovery', actionUrl: '/planes?service=recovery' }),
      expect.objectContaining({ id: 'pack_low:k3', title: 'No te quedan sesiones de Recovery' }),
    ]);
  });

  it('words the pack title for one, several and no sessions left', () => {
    expect(packLowTitle(1)).toBe('Te queda 1 sesión de Recovery');
    expect(packLowTitle(2)).toBe('Te quedan 2 sesiones de Recovery');
    expect(packLowTitle(5)).toBe('Te quedan 5 sesiones de Recovery');
    expect(packLowTitle(0)).toBe('No te quedan sesiones de Recovery');
  });

  it('drops the expiring notice when the plan is already renewed (D49)', () => {
    const renewal = subscription({ id: 'sub-2', status: 'scheduled', startsOn: '2026-10-19', endsOn: '2026-11-18' });
    expect(buildNotices({ ...base, subscription: subscription({}), upcomingSubscription: renewal })).toEqual([]);
    const [notice] = buildNotices({ ...base, subscription: subscription({}), upcomingSubscription: null });
    expect(notice.kind).toBe('plan_expiring');
  });

  it('keeps the order of the contract', () => {
    const notices = buildNotices({
      ...base,
      subscription: subscription({}),
      pendingCheckin: { id: 'c-1', period: '2026-10', firstName: 'Martina' },
      lastAnswered: { period: '2026-09', respondedAt: new Date('2026-10-05T15:00:00.000Z') },
      packs: [pack('k1', 1)],
    });
    expect(notices.map((n) => n.kind)).toEqual(['plan_expiring', 'checkin_pending', 'checkin_answered', 'pack_low']);
    expect(notices[2].title).toBe('Check-in de septiembre respondido');
  });
});
