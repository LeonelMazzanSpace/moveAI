import { alertTypeForFlag, checkinAlertTypes, computeCheckinFlag } from './checkin-rules.js';

describe('computeCheckinFlag', () => {
  it('prioritises pain, then a goals change, else ok', () => {
    expect(computeCheckinFlag({ pain: 'mild', goals: 'adjust' })).toBe('pain');
    expect(computeCheckinFlag({ pain: 'mild', goals: 'same' })).toBe('pain');
    expect(computeCheckinFlag({ pain: 'none', goals: 'adjust' })).toBe('goals');
    expect(computeCheckinFlag({ pain: 'none', goals: 'same' })).toBe('ok');
  });
});

describe('check-in alerts', () => {
  it('raises one alert per reported issue, pain first', () => {
    expect(checkinAlertTypes({ pain: 'mild', goals: 'adjust' })).toEqual(['checkin_pain', 'checkin_goals']);
    expect(checkinAlertTypes({ pain: 'mild', goals: 'same' })).toEqual(['checkin_pain']);
    expect(checkinAlertTypes({ pain: 'none', goals: 'adjust' })).toEqual(['checkin_goals']);
    expect(checkinAlertTypes({ pain: 'none', goals: 'same' })).toEqual([]);
  });

  it('maps a flag to its main alert', () => {
    expect(alertTypeForFlag('pain')).toBe('checkin_pain');
    expect(alertTypeForFlag('goals')).toBe('checkin_goals');
    expect(alertTypeForFlag('ok')).toBeNull();
  });
});
