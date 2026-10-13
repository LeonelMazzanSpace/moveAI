import { Transform, Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, Length, MaxLength, NotContains, ValidateNested } from 'class-validator';
import { EMAIL_LENGTH, NAME_LENGTH, PHONE_LENGTH } from '../../users/dto/update-me.dto.js';

// Postgres text cannot store NUL bytes: reject them at the edge instead of failing with a 500.
const NUL = '\u0000';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class GuestDto {
  @Transform(trim)
  @IsString()
  @NotContains(NUL)
  @Length(NAME_LENGTH.min, NAME_LENGTH.max)
  name: string;

  @Transform(trim)
  @IsString()
  @MaxLength(EMAIL_LENGTH.max)
  @IsEmail()
  email: string;

  @Transform(trim)
  @IsString()
  @NotContains(NUL)
  @Length(PHONE_LENGTH.min, PHONE_LENGTH.max)
  phone: string;
}

export class CheckoutBookingDto {
  @IsUUID()
  planId: string;

  @IsUUID()
  timeSlotId: string;

  // Ignored with a session; required without one (R17, checked by the service).
  @IsOptional()
  @ValidateNested()
  @Type(() => GuestDto)
  guest?: GuestDto;
}
