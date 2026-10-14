import { cleanText, NAME_LENGTH } from './update-me.dto.js';

describe('cleanText', () => {
  it('returns the trimmed value within bounds', () => {
    expect(cleanText('  Ana Pérez  ', NAME_LENGTH)).toBe('Ana Pérez');
  });

  it('rejects non-strings, NUL bytes and values out of bounds', () => {
    expect(cleanText(5, NAME_LENGTH)).toBeNull();
    expect(cleanText('Ana\u0000B', NAME_LENGTH)).toBeNull();
    expect(cleanText(' A ', NAME_LENGTH)).toBeNull();
  });

  // D120: an unpaired UTF-16 surrogate is not a valid string (same rule as the other inputs, T-069).
  it('rejects unpaired surrogates and keeps valid pairs', () => {
    expect(cleanText('Ana\ud800', NAME_LENGTH)).toBeNull();
    expect(cleanText('\udc00Ana', NAME_LENGTH)).toBeNull();
    expect(cleanText('Ana 🏋️', NAME_LENGTH)).toBe('Ana 🏋️');
  });
});
