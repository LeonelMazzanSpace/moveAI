import { assertAutoDebitAllowed, assertDurationClearable, validatePlanShape } from './plan-rules.js';

const base = { periodMonths: null, periodDays: null, sessionsIncluded: null, durationMinutes: null };

describe('validatePlanShape', () => {
  it('accepts the four valid shapes', () => {
    expect(() => validatePlanShape({ ...base, service: 'performance', kind: 'period_plan', periodMonths: 3 })).not.toThrow();
    expect(() => validatePlanShape({ ...base, service: 'recovery', kind: 'session_pack', periodDays: 30, sessionsIncluded: 4, durationMinutes: 45 })).not.toThrow();
    expect(() => validatePlanShape({ ...base, service: 'recovery', kind: 'single_session', durationMinutes: 45 })).not.toThrow();
    expect(() => validatePlanShape({ ...base, service: 'rehab', kind: 'evaluation', durationMinutes: 60 })).not.toThrow();
  });

  it('rejects mismatched service or missing fields', () => {
    expect(() => validatePlanShape({ ...base, service: 'recovery', kind: 'period_plan', periodMonths: 1 })).toThrow();
    expect(() => validatePlanShape({ ...base, service: 'performance', kind: 'period_plan' })).toThrow();
    expect(() => validatePlanShape({ ...base, service: 'recovery', kind: 'session_pack', periodDays: 30 })).toThrow();
    expect(() => validatePlanShape({ ...base, service: 'performance', kind: 'period_plan', periodMonths: 1, sessionsIncluded: 4 })).toThrow();
  });

  it('rejects fields that do not belong to the kind and non-positive values', () => {
    expect(() => validatePlanShape({ ...base, service: 'rehab', kind: 'evaluation', durationMinutes: 60, periodMonths: 1 })).toThrow();
    expect(() => validatePlanShape({ ...base, service: 'recovery', kind: 'single_session', durationMinutes: 45, periodDays: 30 })).toThrow();
    expect(() => validatePlanShape({ ...base, service: 'recovery', kind: 'session_pack', periodDays: 30, sessionsIncluded: 4, periodMonths: 1 })).toThrow();
    expect(() => validatePlanShape({ ...base, service: 'performance', kind: 'period_plan', periodMonths: 0 })).toThrow();
    expect(() => validatePlanShape({ ...base, service: 'rehab', kind: 'evaluation', durationMinutes: 0 })).toThrow();
  });

  it('throws PLAN_KIND_INVALID', () => {
    expect(() => validatePlanShape({ ...base, service: 'performance', kind: 'period_plan' })).toThrowError(
      expect.objectContaining({ code: 'PLAN_KIND_INVALID' }),
    );
  });
});

describe('assertDurationClearable', () => {
  it('lets only a session pack clear its duration', () => {
    expect(() => assertDurationClearable('session_pack')).not.toThrow();
    for (const kind of ['period_plan', 'single_session', 'evaluation'] as const) {
      expect(() => assertDurationClearable(kind)).toThrowError(expect.objectContaining({ code: 'PLAN_KIND_INVALID' }));
    }
  });
});

describe('assertAutoDebitAllowed', () => {
  it('lets period plans and session packs enable the automatic debit', () => {
    expect(() => assertAutoDebitAllowed('period_plan', true)).not.toThrow();
    expect(() => assertAutoDebitAllowed('session_pack', true)).not.toThrow();
  });

  it('rejects it for the kinds paid with a booking', () => {
    for (const kind of ['single_session', 'evaluation'] as const) {
      expect(() => assertAutoDebitAllowed(kind, true)).toThrowError(expect.objectContaining({ code: 'PLAN_KIND_INVALID' }));
      expect(() => assertAutoDebitAllowed(kind, false)).not.toThrow();
    }
  });
});
