import { z } from 'zod';
import type { StaffContactInfoDto } from '@/lib/api/types';

export const CONTACT_FIELD_NAMES = [
  'address',
  'hours',
  'whatsapp',
  'instagram',
  'email',
  'mapsUrl',
  'staffNotificationsEmail',
] as const satisfies readonly (keyof StaffContactInfoDto)[];

const WHATSAPP_PATTERN = /^\+[\d ]{8,20}$/;
const WHATSAPP_DIGITS = { min: 8, max: 15 } as const;
const INSTAGRAM_PATTERN = /^@[A-Za-z0-9._]{1,30}$/;
// Mismo criterio que la API: sin espacios, comillas, `<>`, `()`, `\`, `,`, `;`, `:`, `?` ni `&` (el email termina en un `mailto:` y
// en el destinatario de los avisos), con un dominio con punto y una extensión de al menos 2 letras.
const EMAIL_PATTERN = /^[^\s@"<>()\\,;:?&]+@[^\s@"<>()\\,;:?&]+\.[A-Za-z]{2,}$/;
const EMAIL_LOCAL_MAX = 64;
// NUL y demás caracteres de control, y surrogates UTF-16 sueltos (la API los rechaza).
const INVALID_CHARACTERS = /[\u0000-\u001f\u007f]|\p{Surrogate}/u;

const maxMessage = (max: number) => `Máximo ${max} caracteres.`;
export const INVALID_CHARACTERS_MESSAGE = 'Quitá los caracteres especiales de control.';
export const WHATSAPP_MESSAGE = 'Empezá con + y el código de país, con entre 8 y 15 dígitos. Ej.: +598 99 123 456.';
export const INSTAGRAM_MESSAGE = 'Empezá con @ y usá solo letras, números, puntos y guiones bajos (hasta 30).';
export const MAPS_URL_MESSAGE = 'Ingresá un enlace que empiece con https://';
export const EMAIL_MESSAGE = 'Ingresá un email válido.';

function isWhatsapp(value: string): boolean {
  if (!WHATSAPP_PATTERN.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= WHATSAPP_DIGITS.min && digits <= WHATSAPP_DIGITS.max;
}

function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value) && value.indexOf('@') <= EMAIL_LOCAL_MAX;
}

// `new URL('https:foo.com')` también es https: se exige la barra doble y un host, como `IsUrl` de la API.
function isHttpsUrl(value: string): boolean {
  if (!value.startsWith('https://')) return false;
  try {
    return new URL(value).hostname !== '' && !/\s/.test(value);
  } catch {
    return false;
  }
}

/** Trimmed text of at most `max` characters; `''` clears the field, so the format check only runs on a value. */
function contactText(max: number, format?: { test: (value: string) => boolean; message: string }) {
  const text = z
    .string()
    .trim()
    .max(max, maxMessage(max))
    .refine((value) => !INVALID_CHARACTERS.test(value), INVALID_CHARACTERS_MESSAGE);
  if (!format) return text;
  return text.refine((value) => value === '' || format.test(value), format.message);
}

export const contactFormSchema = z.object({
  address: contactText(200),
  hours: contactText(200),
  whatsapp: contactText(30, { test: isWhatsapp, message: WHATSAPP_MESSAGE }),
  instagram: contactText(31, { test: (value) => INSTAGRAM_PATTERN.test(value), message: INSTAGRAM_MESSAGE }),
  email: contactText(254, { test: isEmail, message: EMAIL_MESSAGE }),
  mapsUrl: contactText(500, { test: isHttpsUrl, message: MAPS_URL_MESSAGE }),
  staffNotificationsEmail: contactText(254, { test: isEmail, message: EMAIL_MESSAGE }),
});

export type ContactFormInput = z.input<typeof contactFormSchema>;
export type ContactFormValues = z.output<typeof contactFormSchema>;

export function contactToFormValues(contact: StaffContactInfoDto): ContactFormInput {
  return Object.fromEntries(CONTACT_FIELD_NAMES.map((name) => [name, contact[name]])) as ContactFormInput;
}

export function changedContact(values: ContactFormValues, current: StaffContactInfoDto): Partial<StaffContactInfoDto> {
  const changes: Partial<StaffContactInfoDto> = {};
  for (const name of CONTACT_FIELD_NAMES) {
    if (values[name] !== current[name]) changes[name] = values[name];
  }
  return changes;
}
