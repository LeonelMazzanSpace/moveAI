import { validate } from 'class-validator';
import { isWellFormedString, IsWellFormed, IsWellFormedEmail, UNPAIRED_SURROGATE } from './well-formed.js';

class Sample {
  @IsWellFormed()
  text: unknown;

  @IsWellFormedEmail()
  email: unknown;
}

const check = async (text: unknown, email: unknown) => {
  const sample = Object.assign(new Sample(), { text, email });
  return (await validate(sample)).map((error) => error.property);
};

describe('isWellFormedString', () => {
  it.each(['', 'plain', 'Ana Pérez', 'Ana 😀', '😀😀', '\u{10000}x', 'a\u0000b'])('accepts %j', (value) => {
    expect(isWellFormedString(value)).toBe(true);
  });

  it.each(['\ud800', 'a\ud800', '\ud800a', '\udbff', '\udc00', 'a\udc00b', '\udfff', '😀\ud800', '\udc00😀', '\ude00\ud83d'])(
    'rejects the unpaired surrogate in %j', (value) => {
      expect(isWellFormedString(value)).toBe(false);
    });

  it.each([undefined, null, 12, true, {}, [], ['a']])('rejects the non-string %j', (value) => {
    expect(isWellFormedString(value)).toBe(false);
  });
});

describe('UNPAIRED_SURROGATE', () => {
  it('matches only lone surrogates', () => {
    expect(UNPAIRED_SURROGATE.test('😀')).toBe(false);
    expect(UNPAIRED_SURROGATE.test('\ud83d')).toBe(true);
  });
});

describe('IsWellFormed', () => {
  it('passes well-formed strings and fails lone surrogates and non-strings', async () => {
    expect(await check('Ana 😀', 'a@b.com')).toEqual([]);
    expect(await check('Ana \ud800', 'a@b.com')).toEqual(['text']);
    expect(await check(7, 'a@b.com')).toEqual(['text']);
  });
});

describe('IsWellFormedEmail', () => {
  it('accepts valid emails', async () => {
    expect(await check('x', 'ana@test.move')).toEqual([]);
  });

  it('rejects malformed emails and non-strings', async () => {
    expect(await check('x', 'not-an-email')).toEqual(['email']);
    expect(await check('x', 12)).toEqual(['email']);
  });

  it('rejects a lone surrogate without throwing the URIError that isEmail raises', async () => {
    expect(await check('x', 'a\udc00@x.com')).toEqual(['email']);
    expect(await check('x', '\ud800')).toEqual(['email']);
  });
});
