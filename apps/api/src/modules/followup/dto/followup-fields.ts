import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, NotContains, ValidateIf } from 'class-validator';

// Years are bounded so a value such as `0000-01-01` never reaches Postgres.
export const DATE_PATTERN = /^20\d{2}-\d{2}-\d{2}$/;
export const PERIOD_PATTERN = /^20\d{2}-(0[1-9]|1[0-2])$/;
export const NOTE_MAX = 1000;
export const CHECKIN_DETAIL_MAX = 500;
// Postgres text cannot store NUL bytes: reject them at the edge instead of failing with a 500.
const NUL = '\u0000';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

// Skips validation only when the field is omitted: `null` still reaches the validators and fails.
export const OptionalField = () => ValidateIf((_, value) => value !== undefined);

export const FreeText = (max: number) => applyDecorators(Transform(trim), IsString(), NotContains(NUL), MaxLength(max));

// Blank optional texts are stored as null.
export const textOrNull = (value: string | undefined): string | null => (value ? value : null);
