import { applyDecorators } from '@nestjs/common';
import { IsBoolean, IsInt, IsNumber, Max, Min, ValidateIf } from 'class-validator';
import type { SettingsValues } from '../models/settings.model.js';

// Skips validation only when the field is omitted: `null` still reaches the validators and fails.
const OptionalField = () => ValidateIf((_, value) => value !== undefined);

// Ranges from "Settings keys" in the data contract.
const IntInRange = (min: number, max: number) => applyDecorators(OptionalField(), IsInt(), Min(min), Max(max));

export class UpdateSettingsDto implements Partial<SettingsValues> {
  @IntInRange(0, 72)
  cancelLimitHours?: number;

  @IntInRange(1, 60)
  bookingWindowDays?: number;

  @IntInRange(5, 120)
  pendingPaymentMinutes?: number;

  @IntInRange(5, 1440)
  reconcileAfterMinutes?: number;

  @IntInRange(1, 30)
  expiringSoonDays?: number;

  @IntInRange(3, 60)
  noAttendanceDays?: number;

  // The cross-field rule (> noAttendanceDays) is checked by SettingsService on the combined values.
  @IntInRange(7, 180)
  prolongedInactivityDays?: number;

  @OptionalField()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.1)
  @Max(0.9)
  frequencyDropRatio?: number;

  @IntInRange(1, 8)
  frequencyRecentWeeks?: number;

  @IntInRange(2, 26)
  frequencyBaselineWeeks?: number;

  @OptionalField()
  @IsBoolean()
  checkinMonthlyEnabled?: boolean;

  @OptionalField()
  @IsBoolean()
  valuesProvisional?: boolean;
}
