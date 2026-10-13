import { Transform } from 'class-transformer';
import { IsString, Length, NotContains, ValidateIf } from 'class-validator';

// Profile field rules shared by PATCH /me, sign-up and invitations.
export const NAME_LENGTH = { min: 2, max: 80 } as const;
export const PHONE_LENGTH = { min: 6, max: 20 } as const;
// Postgres text cannot store NUL bytes: reject them at the edge instead of failing with a 500.
const NUL = '\u0000';

// Returns the trimmed value when it is a string within bounds and without NUL bytes, otherwise null.
export function cleanText(value: unknown, bounds: { min: number; max: number }): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.includes(NUL) || trimmed.length < bounds.min || trimmed.length > bounds.max) return null;
  return trimmed;
}

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class UpdateMeDto {
  // `name` may be omitted but never null (NOT NULL column).
  @Transform(trim)
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @NotContains(NUL)
  @Length(NAME_LENGTH.min, NAME_LENGTH.max)
  name?: string;

  // `phone` may be omitted or cleared with null.
  @Transform(trim)
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @NotContains(NUL)
  @Length(PHONE_LENGTH.min, PHONE_LENGTH.max)
  phone?: string | null;
}
