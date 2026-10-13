import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min, NotContains, ValidateIf } from 'class-validator';

export const MANUAL_METHODS = ['cash', 'transfer'] as const;

export type ManualMethod = (typeof MANUAL_METHODS)[number];

// Same ceiling as a plan price (D38).
export const MANUAL_AMOUNT = { min: 0, max: 10_000_000 } as const;
export const NOTE_MAX = 500;

// Postgres text cannot store NUL bytes: reject them at the edge instead of failing with a 500.
const NUL = '\u0000';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class ManualPaymentDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  planId: string;

  @IsIn(MANUAL_METHODS)
  method: ManualMethod;

  @IsInt()
  @Min(MANUAL_AMOUNT.min)
  @Max(MANUAL_AMOUNT.max)
  amount: number;

  // Omitted or null means no note; a blank note is stored as null.
  @Transform(trim)
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @NotContains(NUL)
  @MaxLength(NOTE_MAX)
  note?: string | null;
}
