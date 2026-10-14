export type Service = 'performance' | 'rehab' | 'recovery';
export type Role = 'client' | 'staff';
export type PlanKind = 'period_plan' | 'session_pack' | 'single_session' | 'evaluation';
export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'expired';
export type BookingSource = 'plan' | 'package' | 'payment' | 'followup';
export type AttendanceStatus = 'present' | 'absent' | 'no_show';
export type SubscriptionStatus = 'active' | 'expiring' | 'expired' | 'scheduled';
export type PurchaseStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
export type PurchaseKind = 'plan' | 'booking';
export type PaymentMethod = 'mercadopago' | 'cash' | 'transfer';
export type ClientStatus = 'active' | 'expiring' | 'inactive' | 'expired' | 'paused' | 'no_plan';
export type PaymentStatusSummary = 'up_to_date' | 'overdue' | 'none';
export type InactivityReasonCode = 'injury' | 'vacation' | 'temporary_pause' | 'no_time' | 'moving' | 'return_later';
export type AlertType =
  | 'expiring' | 'expired' | 'no_attendance' | 'prolonged_inactivity'
  | 'frequency_drop' | 'recontact' | 'checkin_pain' | 'checkin_goals';
export type AlertStatus = 'open' | 'handled';
export type ContactChannel = 'phone' | 'whatsapp' | 'email' | 'in_person';
export type ContactOutcome = 'reached' | 'no_answer' | 'left_message';
export type Feeling = 'struggling' | 'good' | 'very_good';
export type PainLevel = 'none' | 'mild';
export type GoalsChange = 'same' | 'adjust';
export type CheckinFlag = 'ok' | 'pain' | 'goals';
export type ActivityType = 'attendance' | 'booking' | 'cancellation' | 'payment';
export type NoticeKind = 'plan_expiring' | 'plan_expired' | 'checkin_pending' | 'checkin_answered' | 'pack_low';
export type AutoDebitStatus = 'pending' | 'authorized' | 'cancelled';
export type AutoDebitCancelReason = 'client' | 'staff' | 'provider' | 'expired';
export type AutoDebitFrequencyType = 'months' | 'days';
export type PaymentOrigin = 'one_time' | 'auto_debit';
export type CalendarConnectionStatus = 'disconnected' | 'connected' | 'needs_reconnect';
export type JobName =
  | 'followup-detect' | 'checkins-monthly' | 'expiry-reminders'
  | 'generate-slots' | 'expire-holds' | 'reconcile-payments' | 'booking-reminders';

export type ErrorCode =
  | 'VALIDATION_FAILED' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INTERNAL_ERROR'
  | 'PLAN_NOT_FOUND' | 'PLAN_INACTIVE' | 'PLAN_KIND_INVALID' | 'SLUG_TAKEN' | 'SETTINGS_INVALID'
  | 'PROFESSIONAL_NOT_FOUND' | 'TEMPLATE_NOT_FOUND' | 'TEMPLATE_INVALID'
  | 'SLOT_NOT_FOUND' | 'SLOT_NOT_BOOKABLE' | 'SLOT_FULL' | 'SLOT_HAS_BOOKINGS' | 'CAPACITY_BELOW_BOOKED'
  | 'ALREADY_BOOKED' | 'PLAN_REQUIRED' | 'PACKAGE_REQUIRED' | 'REHAB_FOLLOWUP_NOT_ENABLED' | 'SERVICE_MISMATCH'
  | 'BOOKING_NOT_FOUND' | 'BOOKING_NOT_CANCELLABLE' | 'CANCEL_WINDOW_CLOSED' | 'ATTENDANCE_NOT_ALLOWED'
  | 'LOGIN_REQUIRED' | 'HOLD_LIMIT_REACHED' | 'RATE_LIMITED' | 'GUEST_DATA_REQUIRED' | 'EMAIL_ALREADY_REGISTERED' | 'USER_NOT_FOUND'
  | 'PURCHASE_NOT_FOUND' | 'INVALID_SIGNATURE' | 'PAYMENT_PROVIDER_ERROR'
  | 'CLIENT_NOT_FOUND' | 'ALERT_NOT_FOUND' | 'ALERT_ALREADY_HANDLED' | 'PAUSE_ALREADY_ACTIVE' | 'NO_ACTIVE_PAUSE'
  | 'CHECKIN_NOT_FOUND' | 'CHECKIN_ALREADY_ANSWERED' | 'JOB_UNKNOWN'
  | 'AUTO_DEBIT_NOT_ALLOWED' | 'AUTO_DEBIT_ACTIVE' | 'AUTO_DEBIT_NOT_FOUND'
  | 'CALENDAR_NOT_CONFIGURED' | 'CALENDAR_NOT_CONNECTED' | 'CALENDAR_INVALID_CALENDAR' | 'CALENDAR_PROVIDER_ERROR';

export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: { field: string; messages: string[] }[];
}

export interface Paginated<T> { items: T[]; total: number; page: number; pageSize: number; }

export interface MeDto {
  id: string; name: string; email: string; role: Role; phone: string | null; rehabFollowupEnabled: boolean;
}

export interface PlanDto {
  id: string; service: Service; kind: PlanKind; slug: string; name: string; description: string;
  features: string[]; price: number; currency: 'UYU';
  periodMonths: number | null; periodDays: number | null; sessionsIncluded: number | null; durationMinutes: number | null;
  featured: boolean; active: boolean; sortOrder: number; autoDebitEnabled: boolean;
}

// Body of `PATCH /staff/plans/:id`: every field is optional; `durationMinutes: null` clears the duration of a session pack (D89).
export interface PlanUpdateBody {
  slug?: string; name?: string; description?: string; features?: string[]; price?: number;
  periodMonths?: number; periodDays?: number; sessionsIncluded?: number; durationMinutes?: number | null;
  featured?: boolean; active?: boolean; sortOrder?: number; autoDebitEnabled?: boolean;
}

export interface PublicSettingsDto { cancelLimitHours: number; bookingWindowDays: number; }

export interface ContactInfoDto {
  address: string; hours: string; whatsapp: string; instagram: string; email: string; mapsUrl: string;
}
export interface StaffContactInfoDto extends ContactInfoDto { staffNotificationsEmail: string; }

export interface SettingsDto {
  cancelLimitHours: number; bookingWindowDays: number; pendingPaymentMinutes: number; reconcileAfterMinutes: number;
  expiringSoonDays: number; noAttendanceDays: number; prolongedInactivityDays: number; frequencyDropRatio: number;
  frequencyRecentWeeks: number; frequencyBaselineWeeks: number; checkinMonthlyEnabled: boolean; valuesProvisional: boolean;
}

export interface ProfessionalDto { id: string; name: string; active: boolean; }

export interface ScheduleTemplateDto {
  id: string; service: Service; weekday: number; startTime: string; durationMinutes: number; capacity: number;
  professionalId: string | null; professionalName: string | null; active: boolean;
}

export interface SlotProfessional { id: string; name: string; }

export interface TimeSlotDto {
  id: string; service: Service; startsAt: string; endsAt: string; capacity: number;
  booked: number; available: number; isFull: boolean; professional: SlotProfessional | null; bookedByMe: boolean;
}

export interface AvailabilityDayDto { date: string; available: number; }

export interface StaffTimeSlotDto {
  id: string; service: Service; startsAt: string; endsAt: string; capacity: number; professional: SlotProfessional | null;
  cancelledAt: string | null; calendarBlocked: boolean; calendarConflict: boolean;
  booked: number; present: number; absent: number; noShow: number; cancelled: number; pendingAttendance: number;
}

export interface CalendarStatusDto {
  configured: boolean; status: CalendarConnectionStatus; accountEmail: string | null;
  calendarId: string | null; calendarName: string | null; lastPushAt: string | null; lastPullAt: string | null;
}
export interface GoogleCalendarOptionDto { id: string; name: string; primary: boolean; }

export interface SubscriptionDto {
  id: string; planId: string; planName: string; service: 'performance'; startsOn: string; endsOn: string;
  status: SubscriptionStatus; daysLeft: number; progressPct: number;
}

export interface PackDto {
  id: string; planId: string; planName: string; startsOn: string; endsOn: string;
  sessionsTotal: number; sessionsUsed: number; sessionsLeft: number;
}

export interface MySubscriptionsDto {
  performance: SubscriptionDto | null; upcomingPerformance: SubscriptionDto | null; recoveryPacks: PackDto[];
}

export interface BookingDto {
  id: string; timeSlotId: string; service: Service; startsAt: string; endsAt: string; durationMinutes: number;
  label: string; status: BookingStatus; source: BookingSource; attendance: AttendanceStatus | null;
  canCancel: boolean; cancelledAt: string | null;
}

export interface RosterItemDto {
  bookingId: string; client: { id: string; name: string }; planName: string | null; lastAttendanceOn: string | null;
  status: BookingStatus; attendance: AttendanceStatus | null; cancelledAt: string | null;
}

export interface CheckoutResponseDto {
  purchaseId: string; externalReference: string; initPoint: string; bookingId: string | null; holdExpiresAt: string | null;
}

export interface PurchaseStatusDto {
  externalReference: string; status: PurchaseStatus; kind: PurchaseKind; itemName: string; service: Service;
  amount: number; bookingId: string | null; startsAt: string | null; needsAttention: boolean;
  planSlug: string | null;
}

export interface StaffPaymentDto {
  purchaseId: string; client: { id: string; name: string; email: string }; itemName: string; service: Service;
  amount: number; method: PaymentMethod; status: PurchaseStatus; needsAttention: boolean;
  createdAt: string; approvedAt: string | null; note: string | null; origin: PaymentOrigin;
}

export interface AutoDebitDto {
  id: string; planId: string; planName: string; planSlug: string; service: 'performance' | 'recovery';
  status: AutoDebitStatus; amount: number; frequency: number; frequencyType: AutoDebitFrequencyType;
  nextChargeDate: string | null; createdAt: string; cancelledAt: string | null; cancelReason: AutoDebitCancelReason | null;
}
export interface AutoDebitCheckoutDto { externalReference: string; initPoint: string; }
export interface AutoDebitStatusDto {
  externalReference: string; status: AutoDebitStatus; planName: string; planSlug: string;
  service: 'performance' | 'recovery'; amount: number; nextChargeDate: string | null;
}

export interface ClientMetricsDto {
  lastAttendanceOn: string | null; frequencyPerWeek: number; attendancesThisMonth: number;
  cancellations: number; noShows: number; rehabCount: number; recoveryCount: number;
}

export interface ClientRowDto {
  id: string; name: string; email: string; status: ClientStatus; pauseReason: InactivityReasonCode | null;
  planName: string | null; endsOn: string | null; paymentStatus: PaymentStatusSummary;
  lastAttendanceOn: string | null; frequencyPerWeek: number; rehabCount: number; recoveryCount: number;
}

export interface ClientKpisDto {
  active: number; activeDeltaMonth: number; expiringSoon: number; inactive: number; attendancesToday: number; slotsToday: number;
}

export interface ActivityItemDto {
  type: ActivityType; label: string; date: string; amount: number | null; service: Service | null;
}

export interface ContactDto {
  id: string; channel: ContactChannel; outcome: ContactOutcome; note: string | null;
  staffName: string; alertType: AlertType | null; createdAt: string;
}

export interface InactivityReasonDto {
  id: string; reason: InactivityReasonCode; note: string | null; recontactOn: string | null;
  startedAt: string; endedAt: string | null; createdByName: string;
}

export interface ClientDetailDto {
  client: ClientRowDto & { phone: string | null; rehabFollowupEnabled: boolean; createdAt: string };
  subscription: SubscriptionDto | null; upcomingSubscription: SubscriptionDto | null; recoveryPacks: PackDto[];
  metrics: ClientMetricsDto; activePause: InactivityReasonDto | null;
  contacts: ContactDto[]; reasons: InactivityReasonDto[]; history: ActivityItemDto[]; upcomingBookings: BookingDto[];
  autoDebits: AutoDebitDto[];
}

export type AlertCountsDto = Record<AlertType, number> & { total: number };

export interface AlertDto {
  id: string; type: AlertType; status: AlertStatus; client: { id: string; name: string; initials: string };
  planName: string | null; endsOn: string | null; lastAttendanceOn: string | null; frequencyPerWeek: number;
  usualFrequencyPerWeek: number | null; contactsCount: number;
  pause: { reason: InactivityReasonCode; since: string; recontactOn: string | null } | null;
  checkin: { id: string; painDetail: string | null; goalsDetail: string | null } | null;
  createdAt: string;
}

export interface CheckinStatsDto { period: string; sent: number; answered: number; needsIntervention: number; }

export interface CheckinResponseDto {
  id: string; client: { id: string; name: string }; period: string; feeling: Feeling; pain: PainLevel;
  painDetail: string | null; goals: GoalsChange; goalsDetail: string | null; flag: CheckinFlag; respondedAt: string;
  frequencyPerWeek: number; planName: string | null; alertId: string | null; alertStatus: AlertStatus | null;
}

export interface PendingCheckinDto { id: string; period: string; firstName: string; }

export interface NoticeDto { id: string; kind: NoticeKind; title: string; body: string; actionUrl: string | null; }

export interface MyStatsDto { month: string; attendances: number; avgPerWeek: number; }

export interface DashboardDto {
  kpis: ClientKpisDto; alertCounts: AlertCountsDto; todaySlots: StaffTimeSlotDto[]; pendingAttendanceSlots: number;
}

export interface JobRunResultDto { job: JobName; ran: boolean; result: Record<string, number>; }
