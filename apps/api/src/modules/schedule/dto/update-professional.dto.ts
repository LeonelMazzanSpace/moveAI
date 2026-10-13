import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Length, NotContains, ValidateIf } from 'class-validator';
import { NAME_LENGTH, NUL, trim } from './schedule-fields.js';

// Both columns are NOT NULL: a field may be omitted but never null.
export class UpdateProfessionalDto {
  @Transform(trim)
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @NotContains(NUL)
  @Length(NAME_LENGTH.min, NAME_LENGTH.max)
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
