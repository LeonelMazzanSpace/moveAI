import { computeFrequencies, metricsWindowStart } from './metrics.js';

describe('computeFrequencies', () => {
  it('averages present days per week over the windows', () => {
    const today = '2026-10-12';
    // Ventanas (R10): reciente = [29/09, 12/10]; base = [04/08, 28/09]; frecuencia semanal = [15/09, 12/10] / 4.
    const recent = ['2026-10-12', '2026-10-09', '2026-10-06', '2026-10-01'];
    const baseline = Array.from({ length: 24 }, (_, i) => `2026-08-${String(5 + i).padStart(2, '0')}`); // 05/08 … 28/08
    const result = computeFrequencies([...recent, ...baseline], today, 2, 8);
    expect(result.recentFrequency).toBe(2);
    expect(result.baselineFrequency).toBe(3);
    expect(result.frequencyPerWeek).toBe(1);
  });
});

describe('computeFrequencies edge cases', () => {
  it('rounds the weekly frequency to one decimal and ignores dates outside the windows', () => {
    const result = computeFrequencies(['2026-10-12', '2026-10-01', '2026-09-20', '2026-06-01', '2026-10-13'], '2026-10-12', 2, 8);
    expect(result.frequencyPerWeek).toBe(0.8);
    expect(result.recentFrequency).toBe(1);
    expect(result.baselineFrequency).toBe(0.125);
  });

  it('loads enough days for the weekly frequency even with short windows', () => {
    expect(metricsWindowStart('2026-10-12', 1, 2)).toBe('2026-09-15');
    expect(metricsWindowStart('2026-10-12', 2, 8)).toBe('2026-08-04');
  });
});
