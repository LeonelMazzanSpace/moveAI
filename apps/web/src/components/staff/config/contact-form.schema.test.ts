import { describe, expect, it } from 'vitest';
import { EMAIL_MESSAGE, INVALID_CHARACTERS_MESSAGE, MAPS_URL_MESSAGE, contactFormSchema } from './contact-form.schema';

const EMPTY = { address: '', hours: '', whatsapp: '', instagram: '', email: '', mapsUrl: '', staffNotificationsEmail: '' };

function check(field: keyof typeof EMPTY, value: string) {
  return contactFormSchema.safeParse({ ...EMPTY, [field]: value });
}

const MAX_EMAIL = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'b'.repeat(63)}.${'b'.repeat(57)}.com`;
const MAX_MAPS = `https://maps.example/${'a'.repeat(500 - 'https://maps.example/'.length)}`;

describe('contactFormSchema limits', () => {
  it.each([
    ['address', 'a'.repeat(200), 'a'.repeat(201)],
    ['hours', 'a'.repeat(200), 'a'.repeat(201)],
    ['whatsapp', `+${'1'.repeat(15)}`, `+${'1'.repeat(16)}`],
    ['instagram', `@${'a'.repeat(30)}`, `@${'a'.repeat(31)}`],
    ['email', MAX_EMAIL, `${MAX_EMAIL}m`],
    ['staffNotificationsEmail', MAX_EMAIL, `${MAX_EMAIL}m`],
    ['mapsUrl', MAX_MAPS, `${MAX_MAPS}a`],
  ] as const)('accepts the longest %s and rejects one character more', (field, longest, tooLong) => {
    expect(MAX_EMAIL).toHaveLength(254);
    expect(MAX_MAPS).toHaveLength(500);
    expect(check(field, longest).success).toBe(true);
    expect(check(field, tooLong).success).toBe(false);
  });

  it('accepts every field empty, which clears them', () => {
    expect(contactFormSchema.safeParse(EMPTY).success).toBe(true);
  });

  it('trims before checking the length and the format', () => {
    const parsed = check('address', `  ${'a'.repeat(200)}  `);
    expect(parsed.success && parsed.data.address).toBe('a'.repeat(200));
  });
});

describe('contactFormSchema text fields', () => {
  it.each([
    ['NUL', 'Calle\u00001'],
    ['a newline', 'Calle\n1'],
    ['a tab', 'Calle\t1'],
    ['DEL', 'Calle\u007f1'],
    ['an unpaired surrogate', 'Calle\ud83d1'],
  ])('rejects %s in the address and the hours', (_label, value) => {
    expect(check('address', value).success).toBe(false);
    expect(check('hours', value).success).toBe(false);
  });

  it('accepts accents, the middle dot, the en dash and emoji pairs', () => {
    expect(check('hours', 'Lunes a viernes · 7:00 – 11:00 ✓ 🙂').success).toBe(true);
  });
});

describe('contactFormSchema emails', () => {
  it.each(['hola@move.uy', 'ana.perez+move@sub.example.com', "o'brien@example.com"])('accepts %s', (value) => {
    expect(check('email', value).success).toBe(true);
    expect(check('staffNotificationsEmail', value).success).toBe(true);
  });

  it.each([
    ['without a domain', 'ana@'],
    ['without a dot in the domain', 'ana@move'],
    ['with a one-letter top level domain', 'a@b.c'],
    ['with spaces', 'ana perez@move.uy'],
    ['with a local part longer than 64 characters', `${'a'.repeat(65)}@move.uy`],
    ['with a quoted local part', '"ana"@move.uy'],
    ['with CR/LF', 'ana\r\nbcc:x@move.uy'],
    ['with angle brackets', 'ana<x>@move.uy'],
    ['with a display name', 'Ana <ana@move.uy>'],
    ['with a question mark', 'ana?cc=x@move.uy'],
    ['with an ampersand', 'ana&body=x@move.uy'],
    ['with a comma', 'ana@move.uy,otra@move.uy'],
    ['with a semicolon', 'ana@move.uy;otra@move.uy'],
    ['with a backslash', 'ana\\x@move.uy'],
    ['with parentheses', 'ana(x)@move.uy'],
    ['with an unpaired surrogate', 'ana\ud83d@move.uy'],
  ])('rejects an email %s in both email fields', (_label, value) => {
    for (const field of ['email', 'staffNotificationsEmail'] as const) {
      const parsed = check(field, value);
      expect(parsed.success).toBe(false);
      // CR/LF y los surrogates sueltos caen primero en el chequeo de caracteres de control.
      expect([EMAIL_MESSAGE, INVALID_CHARACTERS_MESSAGE]).toContain(parsed.error?.issues[0]?.message);
    }
  });
});

describe('contactFormSchema maps URL', () => {
  it('accepts an https URL', () => {
    expect(check('mapsUrl', 'https://www.google.com/maps/place/MOVE').success).toBe(true);
  });

  it.each([
    ['http', 'http://maps.example/x'],
    ['ftp', 'ftp://maps.example/x'],
    ['javascript', 'javascript:alert(1)'],
    ['https without the slashes', 'https:foo.com'],
    ['https with one slash', 'https:/foo.com'],
    ['https without a host', 'https://'],
    ['a URL with spaces', 'https://maps.example/a b'],
    ['an unparseable text', 'maps'],
  ])('rejects %s', (_label, value) => {
    const parsed = check('mapsUrl', value);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(MAPS_URL_MESSAGE);
  });
});
