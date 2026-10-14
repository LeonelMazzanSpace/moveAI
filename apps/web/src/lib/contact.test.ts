import { describe, expect, it } from 'vitest';
import type { ContactInfoDto } from '@/lib/api/types';
import { hasContactData, instagramUrl, mailtoUrl, whatsappUrl } from './contact';

const EMPTY: ContactInfoDto = { address: '', hours: '', whatsapp: '', instagram: '', email: '', mapsUrl: '' };

describe('whatsappUrl', () => {
  it('keeps only the digits of the number', () => {
    expect(whatsappUrl('+598 99 140 299')).toBe('https://wa.me/59899140299');
  });

  it('returns null for an empty or blank number', () => {
    expect(whatsappUrl('')).toBeNull();
    expect(whatsappUrl('   ')).toBeNull();
  });

  it('returns null when there are no digits at all', () => {
    expect(whatsappUrl('+ -')).toBeNull();
  });
});

describe('instagramUrl', () => {
  it('drops the @ and wraps the handle in the profile URL', () => {
    expect(instagramUrl('@move_strengthconditioning')).toBe('https://www.instagram.com/move_strengthconditioning/');
  });

  it('ignores surrounding spaces', () => {
    expect(instagramUrl('  @move.uy ')).toBe('https://www.instagram.com/move.uy/');
  });

  it('returns null for an empty handle or a lone @', () => {
    expect(instagramUrl('')).toBeNull();
    expect(instagramUrl('  ')).toBeNull();
    expect(instagramUrl('@')).toBeNull();
  });
});

describe('mailtoUrl', () => {
  it('builds a mailto link', () => {
    expect(mailtoUrl('hola@move.uy')).toBe('mailto:hola@move.uy');
  });

  it('trims the address', () => {
    expect(mailtoUrl(' hola@move.uy ')).toBe('mailto:hola@move.uy');
  });

  it('returns null for an empty address', () => {
    expect(mailtoUrl('')).toBeNull();
    expect(mailtoUrl('  ')).toBeNull();
  });
});

describe('hasContactData', () => {
  it('is false when every field is empty or blank', () => {
    expect(hasContactData(EMPTY)).toBe(false);
    expect(hasContactData({ ...EMPTY, address: '   ' })).toBe(false);
  });

  it('is true as soon as one field has a value', () => {
    expect(hasContactData({ ...EMPTY, email: 'hola@move.uy' })).toBe(true);
    expect(hasContactData({ ...EMPTY, mapsUrl: 'https://maps.example/x' })).toBe(true);
  });
});
