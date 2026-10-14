import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateContactDto } from '../dto/update-contact.dto.js';
import { CONTACT_DEFAULTS } from '../settings.defaults.js';

async function failedFields(body: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(UpdateContactDto, body));
  return errors.map(({ property }) => property).sort();
}

const VALID: Record<string, string[]> = {
  address: ['Máximo Tajes 6397 esquina Beranger', 'x'.repeat(200), 'Calle 😀 1'],
  hours: ['Lunes a viernes · 7:00 – 11:00', 'x'.repeat(200)],
  whatsapp: ['+598 99 140 299', '+59899140299', '+12345678', '+123456789012345', '+598 99 140 299 '],
  instagram: ['@move_strengthconditioning', '@a', '@a.b_c9', `@${'a'.repeat(30)}`],
  email: ['hola@move.test', `${'a'.repeat(64)}@${'b'.repeat(60)}.com`],
  mapsUrl: [CONTACT_DEFAULTS.mapsUrl, 'https://maps.app.goo.gl/abc123'],
  staffNotificationsEmail: ['staff@move.test'],
};

const INVALID: Record<string, unknown[]> = {
  address: ['x'.repeat(201), 'a\u0000b', '\ud800', 'a\udc00', 5, null],
  hours: ['x'.repeat(201), 'a\u0000b', '\ud800', 'a\udc00', true, null],
  whatsapp: ['598 99 140 299', '+1234567', '+1234567890123456', '+598-99-140-299', '+598 99 14a 299', '+', '+598 99 14\ud800', 5, null],
  instagram: ['move', '@', `@${'a'.repeat(31)}`, '@con espacio', '@con-guion', '@a\ud800', 5, null],
  email: ['no-es-email', 'a@b', `${'a'.repeat(250)}@b.com`, 'a\u0000@b.com', 'a\ud800@b.com', 5, null],
  mapsUrl: ['http://maps.google.com/x', 'maps.google.com/x', 'javascript:alert(1)', `https://x.com/${'a'.repeat(500)}`, 'https://x.com/\ud800', 5, null],
  staffNotificationsEmail: ['no-es-email', `${'a'.repeat(250)}@b.com`, 'a\udc00@b.com', null],
};

const pairs = (table: Record<string, readonly unknown[]>) =>
  Object.entries(table).flatMap(([field, values]) => values.map((value) => [field, value] as const));

describe('UpdateContactDto', () => {
  it('accepts an empty body (every field is optional)', async () => {
    expect(await failedFields({})).toEqual([]);
  });

  it.each(pairs(VALID))('%s accepts %j', async (field, value) => {
    expect(await failedFields({ [field]: value })).toEqual([]);
  });

  it.each(Object.keys(VALID))('%s accepts an empty string to clear it', async (field) => {
    expect(await failedFields({ [field]: '' })).toEqual([]);
    expect(await failedFields({ [field]: '   ' })).toEqual([]);
  });

  it.each(pairs(INVALID))('%s rejects %j', async (field, value) => {
    expect(await failedFields({ [field]: value })).toEqual([field]);
  });

  it('trims every field before validating', async () => {
    const dto = plainToInstance(UpdateContactDto, {
      address: '  Calle 1  ', whatsapp: ' +598 99 140 299 ', instagram: ' @move ', email: ' a@b.com ', mapsUrl: ' https://x.com/y ',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ address: 'Calle 1', whatsapp: '+598 99 140 299', instagram: '@move', email: 'a@b.com', mapsUrl: 'https://x.com/y' });
  });

  it('leaves omitted fields undefined', () => {
    expect(plainToInstance(UpdateContactDto, { address: 'x' }).hours).toBeUndefined();
  });
});
