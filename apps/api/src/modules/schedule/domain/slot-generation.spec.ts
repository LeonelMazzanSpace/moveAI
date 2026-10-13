import { buildSlotsFromTemplates } from './slot-generation.js';

const template = { id: 't1', service: 'performance' as const, weekday: 1, startTime: '19:00', durationMinutes: 60, capacity: 14, professionalId: null };

describe('buildSlotsFromTemplates', () => {
  it('creates slots on matching weekdays in Montevideo time', () => {
    const slots = buildSlotsFromTemplates([template], '2026-10-12', 14); // 12/10 y 19/10 son lunes
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(['2026-10-12T22:00:00.000Z', '2026-10-19T22:00:00.000Z']);
    expect(slots[0].endsAt.toISOString()).toBe('2026-10-12T23:00:00.000Z');
    expect(slots[0]).toMatchObject({ templateId: 't1', capacity: 14, service: 'performance' });
  });

  it('excludes the end date', () => {
    expect(buildSlotsFromTemplates([template], '2026-10-13', 6)).toHaveLength(0);
  });
});
