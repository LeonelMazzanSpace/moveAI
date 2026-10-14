import type { Service } from '../../catalog/entities/plan.entity.js';
import type { AttendanceStatus } from '../entities/attendance.entity.js';
import type { BookingSource, BookingStatus } from '../entities/booking.entity.js';

export interface BookingModel {
  id: string;
  userId: string;
  timeSlotId: string;
  service: Service;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  source: BookingSource;
  subscriptionId: string | null;
  holdExpiresAt: Date | null;
  cancelledAt: Date | null;
}

// Response shapes of the HTTP contract.

export interface BookingDto {
  id: string;
  timeSlotId: string;
  service: Service;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  label: string;
  status: BookingStatus;
  source: BookingSource;
  attendance: AttendanceStatus | null;
  canCancel: boolean;
  cancelledAt: string | null;
}

export interface RosterItemDto {
  bookingId: string;
  client: { id: string; name: string };
  planName: string | null;
  lastAttendanceOn: string | null;
  status: BookingStatus;
  attendance: AttendanceStatus | null;
  cancelledAt: string | null;
}

export interface SlotProfessional { id: string; name: string }

export interface TimeSlotDto {
  id: string;
  service: Service;
  startsAt: string;
  endsAt: string;
  capacity: number;
  booked: number;
  available: number;
  isFull: boolean;
  professional: SlotProfessional | null;
  bookedByMe: boolean;
}

export interface AvailabilityDayDto { date: string; available: number }

export interface StaffTimeSlotDto {
  id: string;
  service: Service;
  startsAt: string;
  endsAt: string;
  capacity: number;
  professional: SlotProfessional | null;
  cancelledAt: string | null;
  booked: number;
  present: number;
  absent: number;
  noShow: number;
  cancelled: number;
  pendingAttendance: number;
  // D94: busy in Google Calendar; `calendarConflict` = busy and with active bookings.
  calendarBlocked: boolean;
  calendarConflict: boolean;
}

export type ActivityType = 'attendance' | 'booking' | 'cancellation' | 'payment';

export interface ActivityItemDto {
  type: ActivityType;
  label: string;
  date: string;
  amount: number | null;
  service: Service | null;
}
