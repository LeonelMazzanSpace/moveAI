import type { ClientMetricsDto } from '../../bookings/models/user-metrics.model.js';
import type { ActivityItemDto, BookingDto, StaffTimeSlotDto } from '../../bookings/models/booking.model.js';
import type { AlertCountsDto } from '../../followup/models/alert.model.js';
import type { ContactDto } from '../../followup/models/contact.model.js';
import type { InactivityReasonCode, InactivityReasonDto } from '../../followup/models/inactivity.model.js';
import type { PackDto, SubscriptionDto } from '../../subscriptions/models/subscription.model.js';

// Response shapes of the HTTP contract (clients, dashboard and client overview).

export type ClientStatus = 'active' | 'expiring' | 'inactive' | 'expired' | 'paused' | 'no_plan';
export type PaymentStatusSummary = 'up_to_date' | 'overdue' | 'none';
export type NoticeKind = 'plan_expiring' | 'plan_expired' | 'checkin_pending' | 'checkin_answered' | 'pack_low';

export interface ClientRowDto {
  id: string;
  name: string;
  email: string;
  status: ClientStatus;
  pauseReason: InactivityReasonCode | null;
  planName: string | null;
  endsOn: string | null;
  paymentStatus: PaymentStatusSummary;
  lastAttendanceOn: string | null;
  frequencyPerWeek: number;
  rehabCount: number;
  recoveryCount: number;
}

export type ClientSummaryDto = ClientRowDto & { phone: string | null; rehabFollowupEnabled: boolean; createdAt: string };

export interface ClientKpisDto {
  active: number;
  activeDeltaMonth: number;
  expiringSoon: number;
  inactive: number;
  attendancesToday: number;
  slotsToday: number;
}

export interface ClientDetailDto {
  client: ClientSummaryDto;
  subscription: SubscriptionDto | null;
  upcomingSubscription: SubscriptionDto | null;
  recoveryPacks: PackDto[];
  metrics: ClientMetricsDto;
  activePause: InactivityReasonDto | null;
  contacts: ContactDto[];
  reasons: InactivityReasonDto[];
  history: ActivityItemDto[];
  upcomingBookings: BookingDto[];
}

export interface DashboardDto {
  kpis: ClientKpisDto;
  alertCounts: AlertCountsDto;
  todaySlots: StaffTimeSlotDto[];
  pendingAttendanceSlots: number;
}

export interface NoticeDto {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  actionUrl: string | null;
}
