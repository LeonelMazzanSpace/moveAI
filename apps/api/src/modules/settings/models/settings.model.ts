// Staff-editable operational settings (camelCase view of the `settings` table).
export type SettingsValues = {
  cancelLimitHours: number;
  bookingWindowDays: number;
  pendingPaymentMinutes: number;
  reconcileAfterMinutes: number;
  expiringSoonDays: number;
  noAttendanceDays: number;
  prolongedInactivityDays: number;
  frequencyDropRatio: number;
  frequencyRecentWeeks: number;
  frequencyBaselineWeeks: number;
  checkinMonthlyEnabled: boolean;
  valuesProvisional: boolean;
};
