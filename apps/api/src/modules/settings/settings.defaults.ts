import type { SettingsValues } from './models/settings.model.js';

// Provisional values (D10), editable by staff.
export const SETTINGS_DEFAULTS: SettingsValues = {
  cancelLimitHours: 2,
  bookingWindowDays: 14,
  pendingPaymentMinutes: 15,
  reconcileAfterMinutes: 10,
  expiringSoonDays: 7,
  noAttendanceDays: 7,
  prolongedInactivityDays: 21,
  frequencyDropRatio: 0.5,
  frequencyRecentWeeks: 2,
  frequencyBaselineWeeks: 8,
  checkinMonthlyEnabled: true,
  valuesProvisional: true,
};

export const SETTING_DB_KEYS: Record<keyof SettingsValues, string> = {
  cancelLimitHours: 'cancel_limit_hours',
  bookingWindowDays: 'booking_window_days',
  pendingPaymentMinutes: 'pending_payment_minutes',
  reconcileAfterMinutes: 'reconcile_after_minutes',
  expiringSoonDays: 'expiring_soon_days',
  noAttendanceDays: 'no_attendance_days',
  prolongedInactivityDays: 'prolonged_inactivity_days',
  frequencyDropRatio: 'frequency_drop_ratio',
  frequencyRecentWeeks: 'frequency_recent_weeks',
  frequencyBaselineWeeks: 'frequency_baseline_weeks',
  checkinMonthlyEnabled: 'checkin_monthly_enabled',
  valuesProvisional: 'values_provisional',
};
