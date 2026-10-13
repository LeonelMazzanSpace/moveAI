import { SETTINGS_DEFAULTS } from '../../settings/settings.defaults.js';
import { deriveClientStatus } from './client-status.js';

const sub = (startsOn: string, endsOn: string) => ({
  id: 's', userId: 'u', planId: 'p', planName: 'Plan Mensual', service: 'performance' as const, startsOn, endsOn,
  sessionsTotal: null, sessionsUsed: 0, purchaseId: null, createdAt: new Date(),
});
const base = { today: '2026-10-12', settings: SETTINGS_DEFAULTS, paused: false, lastAttendanceOn: '2026-10-10' };

describe('deriveClientStatus', () => {
  it('applies the precedence of R11', () => {
    const current = sub('2026-10-01', '2026-11-01');
    expect(deriveClientStatus({ ...base, paused: true, performance: { current, latest: current } }).status).toBe('paused');
    expect(deriveClientStatus({ ...base, performance: { current: null, latest: null } })).toEqual({ status: 'no_plan', paymentStatus: 'none' });
    expect(deriveClientStatus({ ...base, performance: { current: null, latest: sub('2026-09-02', '2026-10-02') } }))
      .toEqual({ status: 'expired', paymentStatus: 'overdue' });
    const ending = sub('2026-09-14', '2026-10-14');
    expect(deriveClientStatus({ ...base, performance: { current: ending, latest: ending } }).status).toBe('expiring');
    expect(deriveClientStatus({ ...base, lastAttendanceOn: '2026-09-28', performance: { current, latest: current } }).status).toBe('inactive');
    expect(deriveClientStatus({ ...base, performance: { current, latest: current } })).toEqual({ status: 'active', paymentStatus: 'up_to_date' });
  });

  it('pauses win over every other state and keep the payment summary', () => {
    expect(deriveClientStatus({ ...base, paused: true, performance: { current: null, latest: null } }))
      .toEqual({ status: 'paused', paymentStatus: 'none' });
    expect(deriveClientStatus({ ...base, paused: true, performance: { current: null, latest: sub('2026-09-02', '2026-10-02') } }))
      .toEqual({ status: 'paused', paymentStatus: 'overdue' });
  });

  it('checks expiry before inactivity and counts the plan start when the client never attended', () => {
    const ending = sub('2026-09-14', '2026-10-14');
    expect(deriveClientStatus({ ...base, lastAttendanceOn: null, performance: { current: ending, latest: ending } }).status).toBe('expiring');
    const fresh = sub('2026-10-10', '2026-11-10');
    expect(deriveClientStatus({ ...base, lastAttendanceOn: null, performance: { current: fresh, latest: fresh } }).status).toBe('active');
    const stale = sub('2026-10-01', '2026-11-10');
    expect(deriveClientStatus({ ...base, lastAttendanceOn: null, performance: { current: stale, latest: stale } }).status).toBe('inactive');
  });

  it('uses the configured thresholds on their exact boundary', () => {
    const current = sub('2026-09-01', '2026-10-19');
    expect(deriveClientStatus({ ...base, performance: { current, latest: current } }).status).toBe('expiring');
    const later = sub('2026-09-01', '2026-10-20');
    expect(deriveClientStatus({ ...base, performance: { current: later, latest: later } }).status).toBe('active');
    expect(deriveClientStatus({ ...base, lastAttendanceOn: '2026-10-05', performance: { current: later, latest: later } }).status).toBe('inactive');
    expect(deriveClientStatus({ ...base, lastAttendanceOn: '2026-10-06', performance: { current: later, latest: later } }).status).toBe('active');
  });
});
