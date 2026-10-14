import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { isEmail, IsString, IsUrl, Matches, MaxLength, ValidateBy, ValidateIf } from 'class-validator';
import { IsWellFormed, isWellFormedString } from '../../../common/validation/well-formed.js';
import type { StaffContactInfo } from '../models/contact-info.model.js';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

// Skips validation when the field is omitted or empty (`''` clears it), but `null` and non-strings still reach the validators.
const OptionalContact = () => ValidateIf((_, value) => value !== undefined && value !== '');

const WHATSAPP_PATTERN = /^\+[\d ]{8,20}$/;
const WHATSAPP_DIGITS = { min: 8, max: 15 } as const;

export function isContactWhatsapp(value: unknown): boolean {
  if (typeof value !== 'string' || !WHATSAPP_PATTERN.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= WHATSAPP_DIGITS.min && digits <= WHATSAPP_DIGITS.max;
}

const IsContactWhatsapp = () =>
  ValidateBy({
    name: 'isContactWhatsapp',
    validator: { validate: isContactWhatsapp, defaultMessage: () => 'whatsapp must be + followed by 8 to 15 digits' },
  });

// C0 controls (NUL, tab, CR, LF…) and DEL: none belongs in a one-line contact value (M-4). They are single UTF-16 code
// units, so each unit is checked on its own.
const hasControlCharacter = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
};

const NoControlCharacters = () =>
  ValidateBy({
    name: 'noControlCharacters',
    validator: {
      validate: (value: unknown) => typeof value === 'string' && !hasControlCharacter(value),
      defaultMessage: () => 'must not contain control characters',
    },
  });

// M-4: a plain `local@domain` only. A quoted local part could carry line breaks (the staff address would fail at
// Brevo) or `?`/`&` that add parameters to the public `mailto:` link.
const PLAIN_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/;

// The only surrogate check of an email field (T-058 M-4): `isEmail` throws on an unpaired surrogate, so it runs first.
export function isContactEmail(value: unknown): boolean {
  return isWellFormedString(value) && PLAIN_EMAIL.test(value) && isEmail(value, { allow_utf8_local_part: false });
}

const IsContactEmail = () =>
  ValidateBy({ name: 'isContactEmail', validator: { validate: isContactEmail, defaultMessage: () => 'must be a plain email' } });

// Every field is trimmed first; control characters (NUL included) and unpaired surrogates are rejected, so they never
// reach Postgres as a 500.
const ContactText = (max: number) =>
  applyDecorators(Transform(trim), OptionalContact(), IsString(), NoControlCharacters(), IsWellFormed(), MaxLength(max));

const ContactEmail = () =>
  applyDecorators(Transform(trim), OptionalContact(), IsString(), MaxLength(254), IsContactEmail());

export class UpdateContactDto implements Partial<StaffContactInfo> {
  @ContactText(200)
  address?: string;

  @ContactText(200)
  hours?: string;

  @ContactText(30)
  @IsContactWhatsapp()
  whatsapp?: string;

  @ContactText(31)
  @Matches(/^@[A-Za-z0-9._]{1,30}$/)
  instagram?: string;

  @ContactEmail()
  email?: string;

  @ContactText(500)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  mapsUrl?: string;

  @ContactEmail()
  staffNotificationsEmail?: string;
}
