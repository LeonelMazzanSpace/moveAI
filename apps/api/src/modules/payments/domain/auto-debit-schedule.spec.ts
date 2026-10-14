import { firstChargeDate, frequencyOf, isPendingExpired, nextChargeAfter } from './auto-debit-schedule.js';

const plan = { periodMonths: null, periodDays: null };

describe('frequencyOf', () => {
  it('charges a period plan every periodMonths months', () => {
    expect(frequencyOf({ ...plan, kind: 'period_plan', periodMonths: 1 })).toEqual({ frequency: 1, frequencyType: 'months' });
    expect(frequencyOf({ ...plan, kind: 'period_plan', periodMonths: 3 })).toEqual({ frequency: 3, frequencyType: 'months' });
  });

  it('charges a session pack every periodDays days', () => {
    expect(frequencyOf({ ...plan, kind: 'session_pack', periodDays: 30 })).toEqual({ frequency: 30, frequencyType: 'days' });
  });

  it('rejects the kinds that cannot be debited', () => {
    expect(() => frequencyOf({ ...plan, kind: 'single_session' })).toThrowError(
      expect.objectContaining({ code: 'AUTO_DEBIT_NOT_ALLOWED' }),
    );
    expect(() => frequencyOf({ ...plan, kind: 'evaluation' })).toThrowError(
      expect.objectContaining({ code: 'AUTO_DEBIT_NOT_ALLOWED' }),
    );
    expect(() => frequencyOf({ ...plan, kind: 'period_plan' })).toThrowError(
      expect.objectContaining({ code: 'AUTO_DEBIT_NOT_ALLOWED' }),
    );
  });
});

describe('firstChargeDate', () => {
  const today = '2026-10-14';

  it('starts a Performance debit the day after the current period ends', () => {
    expect(firstChargeDate('performance', '2026-11-15', today)).toBe('2026-11-16');
  });

  it('treats a period ending today as current', () => {
    expect(firstChargeDate('performance', today, today)).toBe('2026-10-15');
  });

  it('charges immediately without a current Performance period', () => {
    expect(firstChargeDate('performance', null, today)).toBeNull();
    expect(firstChargeDate('performance', '2026-10-13', today)).toBeNull();
  });

  it('charges a Recovery debit immediately', () => {
    expect(firstChargeDate('recovery', '2026-11-15', today)).toBeNull();
    expect(firstChargeDate('recovery', null, today)).toBeNull();
  });
});

describe('isPendingExpired', () => {
  const createdAt = new Date('2026-10-14T12:00:00.000Z');

  it('expires a pending debit after 24 hours', () => {
    expect(isPendingExpired(createdAt, new Date('2026-10-15T12:00:00.001Z'))).toBe(true);
  });

  it('keeps it until then', () => {
    expect(isPendingExpired(createdAt, new Date('2026-10-15T12:00:00.000Z'))).toBe(false);
    expect(isPendingExpired(createdAt, new Date('2026-10-14T13:00:00.000Z'))).toBe(false);
  });
});

describe('nextChargeAfter', () => {
  it('adds the debit frequency to a charge date', () => {
    expect(nextChargeAfter('2026-01-31', { frequency: 1, frequencyType: 'months' })).toBe('2026-02-28');
    expect(nextChargeAfter('2026-10-14', { frequency: 3, frequencyType: 'months' })).toBe('2027-01-14');
    expect(nextChargeAfter('2026-10-14', { frequency: 30, frequencyType: 'days' })).toBe('2026-11-13');
  });
});
