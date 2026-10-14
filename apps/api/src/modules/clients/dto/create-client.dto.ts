import { Transform } from 'class-transformer';
import { IsString, Length, MaxLength, NotContains, ValidateIf } from 'class-validator';
import { IsWellFormed, IsWellFormedEmail } from '../../../common/validation/well-formed.js';
import { EMAIL_LENGTH, NAME_LENGTH, PHONE_LENGTH } from '../../users/dto/update-me.dto.js';

// Postgres text cannot store NUL bytes: reject them at the edge instead of failing with a 500.
const NUL = '\u0000';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateClientDto {
  @Transform(trim)
  @IsString()
  @NotContains(NUL)
  @IsWellFormed()
  @Length(NAME_LENGTH.min, NAME_LENGTH.max)
  name: string;

  @Transform(trim)
  @IsWellFormedEmail()
  @MaxLength(EMAIL_LENGTH.max)
  email: string;

  // Omitted means no phone; `null` is rejected.
  @Transform(trim)
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @NotContains(NUL)
  @IsWellFormed()
  @Length(PHONE_LENGTH.min, PHONE_LENGTH.max)
  phone?: string;
}
