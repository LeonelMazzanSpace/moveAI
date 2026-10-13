import { IsString, Length, ValidateIf } from 'class-validator';

export class UpdateMeDto {
  // `name` may be omitted but never null (NOT NULL column).
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(2, 80)
  name?: string;

  // `phone` may be omitted or cleared with null.
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Length(6, 20)
  phone?: string | null;
}
