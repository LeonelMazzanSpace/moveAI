import { describe, expect, it } from 'vitest';
import { FILTERS, parseFilter, servicesFor } from './plan-filter';

describe('parseFilter', () => {
  it('accepts the two catalog services', () => {
    expect(parseFilter('performance')).toBe('performance');
    expect(parseFilter('recovery')).toBe('recovery');
  });

  it.each([undefined, '', 'rehab', 'Performance', ['performance'], ['performance', 'recovery'], 'constructor', '__proto__', 'toString'])(
    'ignores %j',
    (value) => {
      expect(parseFilter(value)).toBeUndefined();
    },
  );
});

describe('servicesFor', () => {
  it('shows both catalogs without a filter', () => {
    expect(servicesFor(undefined)).toEqual(['performance', 'recovery']);
  });

  it('shows only the selected catalog', () => {
    expect(servicesFor('performance')).toEqual(['performance']);
    expect(servicesFor('recovery')).toEqual(['recovery']);
  });
});

describe('FILTERS', () => {
  it('offers all, performance and recovery in that order', () => {
    expect(FILTERS.map((filter) => filter.value)).toEqual([undefined, 'performance', 'recovery']);
  });
});
