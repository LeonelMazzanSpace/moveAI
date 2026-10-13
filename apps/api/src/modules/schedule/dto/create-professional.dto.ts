import { Transform } from 'class-transformer';
import { IsString, Length, NotContains } from 'class-validator';
import { NAME_LENGTH, NUL, trim } from './schedule-fields.js';

export class CreateProfessionalDto {
  @Transform(trim)
  @IsString()
  @NotContains(NUL)
  @Length(NAME_LENGTH.min, NAME_LENGTH.max)
  name: string;
}
