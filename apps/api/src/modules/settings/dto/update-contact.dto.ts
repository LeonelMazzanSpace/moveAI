import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, IsUrl, Matches, MaxLength, NotContains, ValidateBy, ValidateIf } from 'class-validator';
import { IsWellFormed, IsWellFormedEmail } from '../../../common/validation/well-formed.js';
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

// Every field is trimmed first; NUL and unpaired surrogates are rejected so they never reach Postgres as a 500.
const ContactText = (max: number) =>
  applyDecorators(Transform(trim), OptionalContact(), IsString(), NotContains('\u0000'), IsWellFormed(), MaxLength(max));

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

  @ContactText(254)
  @IsWellFormedEmail()
  email?: string;

  @ContactText(500)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  mapsUrl?: string;

  @ContactText(254)
  @IsWellFormedEmail()
  staffNotificationsEmail?: string;
}
