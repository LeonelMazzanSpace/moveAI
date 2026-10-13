import { matchesClientSearch } from './search.js';

const row = { name: 'Lucía Pereira', email: 'lu.pereira@gmail.com', planName: 'Plan Mensual' };

describe('matchesClientSearch', () => {
  it('ignores case and accents in name, email and plan', () => {
    expect(matchesClientSearch(row, 'lucia')).toBe(true);
    expect(matchesClientSearch(row, 'LUCÍA')).toBe(true);
    expect(matchesClientSearch(row, 'MENSUAL')).toBe(true);
    expect(matchesClientSearch(row, 'gmail')).toBe(true);
    expect(matchesClientSearch(row, 'trimestral')).toBe(false);
  });

  it('matches everything on a blank query and handles clients without plan', () => {
    expect(matchesClientSearch(row, '')).toBe(true);
    expect(matchesClientSearch(row, '   ')).toBe(true);
    expect(matchesClientSearch({ ...row, planName: null }, 'mensual')).toBe(false);
  });

  it('trims the query and matches accented search terms against plain text', () => {
    expect(matchesClientSearch(row, '  pereira ')).toBe(true);
    expect(matchesClientSearch({ ...row, name: 'Nicolas Nuñez' }, 'núñez')).toBe(true);
  });
});
