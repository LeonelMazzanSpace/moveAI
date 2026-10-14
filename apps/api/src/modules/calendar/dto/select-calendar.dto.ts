import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, NotContains, ValidateBy } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

// In `u` mode a valid surrogate pair is one code point, so only unpaired surrogates match.
const UNPAIRED_SURROGATE = /\p{Surrogate}/u;

const IsWellFormed = () =>
  ValidateBy({
    name: 'isWellFormed',
    validator: {
      validate: (value: unknown) => typeof value === 'string' && !UNPAIRED_SURROGATE.test(value),
      defaultMessage: () => 'must not contain unpaired surrogates',
    },
  });

// The id must also be in the account's calendar list (checked by the service: CALENDAR_INVALID_CALENDAR).
export class SelectCalendarDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @NotContains('\u0000')
  @IsWellFormed()
  calendarId: string;
}
