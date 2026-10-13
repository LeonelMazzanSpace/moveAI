import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { businessTime, businessToday, toBusinessDate } from '../../../common/time/business-time.js';
import { NotificationsService } from '../../notifications/services/notifications.service.js';
import type { TimeSlotModel } from '../../schedule/models/time-slot.model.js';
import { ScheduleService } from '../../schedule/services/schedule.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service.js';
import { UsersService } from '../../users/services/users.service.js';
import {
  ACTIVE_STATUSES, SERVICE_LABEL, bookingLabel, canClientCancel, displayDate, durationMinutes, isBookable,
  isClientCancellable, isWithinCancelWindow,
} from '../domain/booking-rules.js';
import type { AttendanceStatus } from '../entities/attendance.entity.js';
import type { BookingSource, BookingStatus } from '../entities/booking.entity.js';
import type { BookingScope } from '../dto/my-bookings.query.js';
import type { ActivityItemDto, BookingDto, BookingModel, RosterItemDto } from '../models/booking.model.js';
import { AttendanceService } from './attendance.service.js';
import { SlotStatsService } from './slot-stats.service.js';

type BookingRow = BookingModel & { attendance: AttendanceStatus | null };

interface Entitlement { source: BookingSource; subscriptionId: string | null }

const BOOKING_SELECT = `
  SELECT b.id, b.user_id AS "userId", b.time_slot_id AS "timeSlotId", s.service, s.starts_at AS "startsAt",
    s.ends_at AS "endsAt", b.status, b.source, b.subscription_id AS "subscriptionId",
    b.hold_expires_at AS "holdExpiresAt", b.cancelled_at AS "cancelledAt", a.status AS attendance
  FROM bookings b
  JOIN time_slots s ON s.id = b.time_slot_id
  LEFT JOIN attendances a ON a.booking_id = b.id`;

const PAST_LIMIT = 50;
const MINUTE_MS = 60_000;

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: 'Asistencia',
  absent: 'Ausencia',
  no_show: 'No show',
};

const toModel = ({ attendance: _attendance, ...booking }: BookingRow): BookingModel => booking;

const toDto = (row: BookingRow, now: Date, cancelLimitHours: number): BookingDto => {
  const minutes = durationMinutes(row.startsAt, row.endsAt);
  return {
    id: row.id,
    timeSlotId: row.timeSlotId,
    service: row.service,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    durationMinutes: minutes,
    label: bookingLabel(row.service, row.source, minutes),
    status: row.status,
    source: row.source,
    attendance: row.attendance,
    canCancel: canClientCancel({ ...row, now, cancelLimitHours }),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
};

const toActivityItem = (row: BookingRow): ActivityItemDto => {
  const where = `${SERVICE_LABEL[row.service]} ${businessTime(row.startsAt)}`;
  const base = { date: row.startsAt.toISOString(), amount: null, service: row.service };
  if (row.status === 'cancelled') return { ...base, type: 'cancellation', label: `Reserva cancelada — ${where}` };
  if (row.attendance) return { ...base, type: 'attendance', label: `${ATTENDANCE_LABEL[row.attendance]} — ${where}` };
  return { ...base, type: 'booking', label: `Reserva — ${where}` };
};

const isActiveDuplicate = (error: unknown): boolean => {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as { code?: string; constraint?: string };
  return driverError.code === '23505' && driverError.constraint === 'UQ_bookings_active_user_slot';
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly schedule: ScheduleService,
    private readonly subscriptions: SubscriptionsService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly slotStats: SlotStatsService,
    private readonly attendance: AttendanceService,
  ) {}

  // R6, in one transaction: the slot row lock serializes every booking of the slot.
  async book(userId: string, timeSlotId: string): Promise<BookingDto> {
    const [windowDays, cancelLimitHours] = await Promise.all([
      this.settings.get('bookingWindowDays'),
      this.settings.get('cancelLimitHours'),
    ]);
    const booking = await this.dataSource.transaction(async (manager) => {
      const slot = await this.lockBookableSlot(manager, timeSlotId, windowDays);
      await this.assertRoom(manager, userId, slot);
      const entitlement = await this.claimEntitlement(manager, userId, slot);
      return this.insert(manager, { userId, slot, status: 'confirmed', ...entitlement, holdExpiresAt: null });
    });
    await this.sendBookingConfirmation(booking.id);
    return toDto({ ...booking, attendance: null }, new Date(), cancelLimitHours);
  }

  // R8: steps 1–4 of R6, without the entitlement; the caller owns the transaction.
  async holdForPayment(
    manager: EntityManager,
    input: { userId: string; timeSlotId: string; expectedService: 'rehab' | 'recovery'; holdMinutes: number },
  ): Promise<BookingModel> {
    const windowDays = await this.settings.get('bookingWindowDays');
    const slot = await this.schedule.lockSlot(manager, input.timeSlotId);
    if (slot.service !== input.expectedService) throw new AppError('SERVICE_MISMATCH');
    this.assertBookable(slot, windowDays);
    await this.assertRoom(manager, input.userId, slot);
    return this.insert(manager, {
      userId: input.userId,
      slot,
      status: 'pending_payment',
      source: 'payment',
      subscriptionId: null,
      holdExpiresAt: new Date(Date.now() + input.holdMinutes * MINUTE_MS),
    });
  }

  // R8. A hold cancelled by staff or by a rejected payment is not revived: it answers SLOT_FULL so payments
  // flags the purchase for staff (D23).
  async confirmPaid(manager: EntityManager, bookingId: string): Promise<BookingModel> {
    const booking = await this.lockBooking(manager, bookingId);
    if (booking.status === 'confirmed') return booking;
    if (booking.status === 'cancelled') throw new AppError('SLOT_FULL');
    if (booking.status === 'expired') {
      const slot = await this.schedule.lockSlot(manager, booking.timeSlotId);
      if (slot.cancelledAt) throw new AppError('SLOT_FULL');
      await this.assertRoom(manager, booking.userId, slot);
    }
    await manager.query(
      `UPDATE bookings SET status = 'confirmed', confirmed_at = now(), cancelled_at = NULL, cancelled_by = NULL, updated_at = now()
       WHERE id = $1`,
      [bookingId],
    );
    return { ...booking, status: 'confirmed', cancelledAt: null };
  }

  async releaseHold(manager: EntityManager, bookingId: string, reason: 'expired' | 'cancelled'): Promise<void> {
    await manager.query(
      `UPDATE bookings SET status = $2, cancelled_at = now(), cancelled_by = 'system', updated_at = now()
       WHERE id = $1 AND status = 'pending_payment'`,
      [bookingId, reason],
    );
  }

  async expireHolds(now: Date): Promise<number> {
    const [{ count }]: { count: number }[] = await this.dataSource.query(
      `WITH expired AS (
         UPDATE bookings SET status = 'expired', cancelled_at = $1, cancelled_by = 'system', updated_at = now()
         WHERE status = 'pending_payment' AND hold_expires_at < $1 AND deleted_at IS NULL
         RETURNING id
       ) SELECT count(*)::int AS count FROM expired`,
      [now],
    );
    return count;
  }

  // R7 (client). Another client's booking answers BOOKING_NOT_FOUND, like a missing one.
  async cancelByClient(userId: string, bookingId: string): Promise<BookingDto> {
    const cancelLimitHours = await this.settings.get('cancelLimitHours');
    await this.dataSource.transaction(async (manager) => {
      const booking = await this.lockBooking(manager, bookingId);
      if (booking.userId !== userId) throw new AppError('BOOKING_NOT_FOUND');
      if (!isClientCancellable(booking.status, booking.source)) throw new AppError('BOOKING_NOT_CANCELLABLE');
      if (!isWithinCancelWindow(booking.startsAt, new Date(), cancelLimitHours)) throw new AppError('CANCEL_WINDOW_CLOSED');
      await this.cancel(manager, booking, 'client');
    });
    const [row] = await this.findRows(`b.id = $1`, [bookingId]);
    return toDto(row, new Date(), cancelLimitHours);
  }

  // R7 (staff): any active booking, no time limit; the client is emailed after the commit.
  async cancelByStaff(bookingId: string): Promise<RosterItemDto> {
    const booking = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lockBooking(manager, bookingId);
      if (!ACTIVE_STATUSES.includes(locked.status)) throw new AppError('BOOKING_NOT_CANCELLABLE');
      await this.cancel(manager, locked, 'staff');
      return locked;
    });
    await this.sendCancellation(booking);
    return this.attendance.getRosterItem(bookingId);
  }

  // `upcoming`: active bookings of slots that have not started. `past`: started slots and cancelled bookings
  // (never expired holds), latest first.
  async listForUser(userId: string, scope: BookingScope): Promise<BookingDto[]> {
    const now = new Date();
    const cancelLimitHours = await this.settings.get('cancelLimitHours');
    const rows =
      scope === 'upcoming'
        ? await this.findRows(
            `b.user_id = $1 AND b.status IN ('pending_payment','confirmed') AND s.starts_at > $2 ORDER BY s.starts_at, b.created_at`,
            [userId, now],
          )
        : await this.findRows(
            `b.user_id = $1 AND b.status <> 'expired' AND (s.starts_at <= $2 OR b.status = 'cancelled')
             ORDER BY s.starts_at DESC, b.created_at DESC LIMIT ${PAST_LIMIT}`,
            [userId, now],
          );
    return rows.map((row) => toDto(row, now, cancelLimitHours));
  }

  // Attended slots, cancelled bookings and upcoming confirmed bookings, latest first.
  async listActivityForUser(userId: string): Promise<ActivityItemDto[]> {
    const rows = await this.findRows(
      `b.user_id = $1 AND (b.status = 'cancelled' OR (b.status = 'confirmed' AND (a.id IS NOT NULL OR s.starts_at > $2)))
       ORDER BY s.starts_at DESC, b.created_at DESC`,
      [userId, new Date()],
    );
    return rows.map(toActivityItem);
  }

  // Never throws: the booking is already committed when this runs.
  async sendBookingConfirmation(bookingId: string): Promise<void> {
    try {
      const booking = await this.getBooking(bookingId);
      const user = await this.users.findById(booking.userId);
      if (!user) return;
      await this.notifications.send({
        template: 'booking-confirmed',
        to: { email: user.email, name: user.name },
        userId: user.id,
        idempotencyKey: `booking-confirmed:${booking.id}`,
        params: {
          name: user.name,
          serviceName: SERVICE_LABEL[booking.service],
          label: bookingLabel(booking.service, booking.source, durationMinutes(booking.startsAt, booking.endsAt)),
          date: displayDate(toBusinessDate(booking.startsAt)),
          time: businessTime(booking.startsAt),
        },
      });
    } catch {
      this.logger.error(`booking-confirmed email failed booking=${bookingId}`);
    }
  }

  async getBooking(bookingId: string): Promise<BookingModel> {
    const [row] = await this.findRows(`b.id = $1`, [bookingId]);
    if (!row) throw new AppError('BOOKING_NOT_FOUND');
    return toModel(row);
  }

  private async sendCancellation(booking: BookingModel): Promise<void> {
    try {
      const user = await this.users.findById(booking.userId);
      if (!user) return;
      await this.notifications.send({
        template: 'booking-cancelled',
        to: { email: user.email, name: user.name },
        userId: user.id,
        idempotencyKey: `booking-cancelled:${booking.id}`,
        params: {
          name: user.name,
          serviceName: SERVICE_LABEL[booking.service],
          date: displayDate(toBusinessDate(booking.startsAt)),
          time: businessTime(booking.startsAt),
        },
      });
    } catch {
      this.logger.error(`booking-cancelled email failed booking=${booking.id}`);
    }
  }

  // R6 steps 1–2.
  private async lockBookableSlot(manager: EntityManager, slotId: string, windowDays: number): Promise<TimeSlotModel> {
    const slot = await this.schedule.lockSlot(manager, slotId);
    this.assertBookable(slot, windowDays);
    return slot;
  }

  private assertBookable(slot: TimeSlotModel, windowDays: number): void {
    const now = new Date();
    if (!isBookable(slot, now, businessToday(now), windowDays)) throw new AppError('SLOT_NOT_BOOKABLE');
  }

  // R6 steps 3–4; the slot must already be locked.
  private async assertRoom(manager: EntityManager, userId: string, slot: TimeSlotModel): Promise<void> {
    const [{ exists }]: { exists: boolean }[] = await manager.query(
      `SELECT EXISTS (
         SELECT 1 FROM bookings
         WHERE user_id = $1 AND time_slot_id = $2 AND status IN ('pending_payment','confirmed') AND deleted_at IS NULL
       ) AS exists`,
      [userId, slot.id],
    );
    if (exists) throw new AppError('ALREADY_BOOKED');
    if ((await this.slotStats.countActive(manager, slot.id)) >= slot.capacity) throw new AppError('SLOT_FULL');
  }

  // R6 step 5, evaluated on the business date of the slot (R2).
  private async claimEntitlement(manager: EntityManager, userId: string, slot: TimeSlotModel): Promise<Entitlement> {
    const date = toBusinessDate(slot.startsAt);
    if (slot.service === 'performance') {
      const subscription = await this.subscriptions.findCoveringPerformance(manager, userId, date);
      if (!subscription) throw new AppError('PLAN_REQUIRED');
      return { source: 'plan', subscriptionId: subscription.id };
    }
    if (slot.service === 'recovery') {
      const pack = await this.subscriptions.consumePackSession(manager, userId, date);
      if (!pack) throw new AppError('PACKAGE_REQUIRED');
      return { source: 'package', subscriptionId: pack.id };
    }
    const user = await this.users.findById(userId);
    if (!user?.rehabFollowupEnabled) throw new AppError('REHAB_FOLLOWUP_NOT_ENABLED');
    return { source: 'followup', subscriptionId: null };
  }

  private async insert(
    manager: EntityManager,
    input: {
      userId: string;
      slot: TimeSlotModel;
      status: BookingStatus;
      source: BookingSource;
      subscriptionId: string | null;
      holdExpiresAt: Date | null;
    },
  ): Promise<BookingModel> {
    try {
      const [{ id, cancelledAt }]: { id: string; cancelledAt: Date | null }[] = await manager.query(
        `INSERT INTO bookings (user_id, time_slot_id, status, source, subscription_id, hold_expires_at, confirmed_at)
         VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $3 = 'confirmed' THEN now() END)
         RETURNING id, cancelled_at AS "cancelledAt"`,
        [input.userId, input.slot.id, input.status, input.source, input.subscriptionId, input.holdExpiresAt],
      );
      return {
        id,
        userId: input.userId,
        timeSlotId: input.slot.id,
        service: input.slot.service,
        startsAt: input.slot.startsAt,
        endsAt: input.slot.endsAt,
        status: input.status,
        source: input.source,
        subscriptionId: input.subscriptionId,
        holdExpiresAt: input.holdExpiresAt,
        cancelledAt,
      };
    } catch (error) {
      if (isActiveDuplicate(error)) throw new AppError('ALREADY_BOOKED');
      throw error;
    }
  }

  private async lockBooking(manager: EntityManager, bookingId: string): Promise<BookingModel> {
    const [row]: BookingRow[] = await manager.query(
      `${BOOKING_SELECT} WHERE b.id = $1 AND b.deleted_at IS NULL FOR UPDATE OF b`,
      [bookingId],
    );
    if (!row) throw new AppError('BOOKING_NOT_FOUND');
    return toModel(row);
  }

  // The booking is kept for metrics; a package booking gives its session back.
  private async cancel(manager: EntityManager, booking: BookingModel, by: 'client' | 'staff'): Promise<void> {
    await manager.query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = now(), cancelled_by = $2, updated_at = now() WHERE id = $1`,
      [booking.id, by],
    );
    if (booking.source === 'package' && booking.subscriptionId) {
      await this.subscriptions.releasePackSession(manager, booking.subscriptionId);
    }
  }

  // `where` may end with ORDER BY / LIMIT clauses.
  private findRows(where: string, params: unknown[]): Promise<BookingRow[]> {
    return this.dataSource.query(`${BOOKING_SELECT} WHERE b.deleted_at IS NULL AND ${where}`, params);
  }
}
