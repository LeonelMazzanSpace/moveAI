import { IsIn, IsISO8601, Matches } from 'class-validator';
import { INACTIVITY_REASON_CODES, type InactivityReasonCode } from '../models/inactivity.model.js';
import { DATE_PATTERN, FreeText, NOTE_MAX, OptionalField } from './followup-fields.js';

export class StartInactivityDto {
  @IsIn(INACTIVITY_REASON_CODES)
  reason: InactivityReasonCode;

  @OptionalField()
  @FreeText(NOTE_MAX)
  note?: string;

  // Must also be today or later (checked by the service against the business date).
  @OptionalField()
  @Matches(DATE_PATTERN)
  @IsISO8601({ strict: true })
  recontactOn?: string;
}
