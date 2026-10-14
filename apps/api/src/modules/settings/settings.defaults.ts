import type { StaffContactInfo } from './models/contact-info.model.js';
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

// Initial contact data (current moveperformance.uy site); editable by staff.
export const CONTACT_DEFAULTS: StaffContactInfo = {
  address: 'Máximo Tajes 6397 esquina Beranger',
  hours: 'Lunes a viernes · 7:00 – 11:00 · 15:00 – 20:00',
  whatsapp: '+598 99 140 299',
  instagram: '@move_strengthconditioning',
  email: '',
  mapsUrl:
    'https://www.google.com/maps/place/MOVE+Strength%26Conditioning/@-34.8773036,-56.0787995,17z/data=!4m6!3m5!1s0x959f8730c171b183:0x6e7a19d4869b4b26!8m2!3d-34.8773036!4d-56.0787995!16s%2Fg%2F11g22zyvcy',
  staffNotificationsEmail: '',
};

export const CONTACT_DB_KEYS: Record<keyof StaffContactInfo, string> = {
  address: 'contact_address',
  hours: 'contact_hours',
  whatsapp: 'contact_whatsapp',
  instagram: 'contact_instagram',
  email: 'contact_email',
  mapsUrl: 'contact_maps_url',
  staffNotificationsEmail: 'staff_notifications_email',
};
