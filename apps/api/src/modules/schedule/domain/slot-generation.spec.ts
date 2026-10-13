import { buildSlotsFromTemplates } from './slot-generation.js';

const template = { id: 't1', service: 'performance' as const, weekday: 1, startTime: '19:00', durationMinutes: 60, capacity: 14, professionalId: null };

describe('buildSlotsFromTemplates', () => {
  it('creates slots on matching weekdays in Montevideo time', () => {
    const slots = buildSlotsFromTemplates([template], '2026-10-12', 14); // 12/10 y 19/10 son lunes
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(['2026-10-12T22:00:00.000Z', '2026-10-19T22:00:00.000Z']);
    expect(slots[0].endsAt.toISOString()).toBe('2026-10-12T23:00:00.000Z');
    expect(slots[0]).toMatchObject({ templateId: 't1', capacity: 14, service: 'performance' });
  });

  // The local weekday decides the match, even when the UTC instant is already the next day.
  it.each([
    ['21:00', '2026-10-13T00:00:00.000Z'],
    ['23:30', '2026-10-13T02:30:00.000Z'],
  ])('puts a %s local template on its local weekday although the UTC instant is the next day', (startTime, expected) => {
    const slots = buildSlotsFromTemplates([{ ...template, startTime }], '2026-10-12', 1); // 12/10 is Monday, 13/10 Tuesday
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([expected]);
    expect(buildSlotsFromTemplates([{ ...template, startTime, weekday: 2 }], '2026-10-12', 1)).toHaveLength(0);
  });

  it('excludes the end date', () => {
    expect(buildSlotsFromTemplates([template], '2026-10-13', 6)).toHaveLength(0);
  });
});
