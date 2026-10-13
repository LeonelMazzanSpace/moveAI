import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { toPaginated, type Paginated, type PaginationQueryDto } from '../../../common/http/pagination.js';
import { businessDayEnd, businessDayStart, businessToday, toBusinessDate } from '../../../common/time/business-time.js';
import { ScheduleService } from '../../schedule/services/schedule.service.js';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service.js';
import type { AttendanceStatus } from '../entities/attendance.entity.js';
import type { BookingStatus } from '../entities/booking.entity.js';
import type { RosterItemDto } from '../models/booking.model.js';
import { ActivityMetricsService } from './activity-metrics.service.js';

interface RosterRow {
  bookingId: string;
  userId: string;
  userName: string;
  status: BookingStatus;
  cancelledAt: Date | null;
  attendance: AttendanceStatus | null;
  startsAt: Date;
}

// Expired holds were never real bookings, so the roster leaves them out.
const ROSTER_SELECT = `
  SELECT b.id AS "bookingId", u.id AS "userId", u.name AS "userName", b.status, b.cancelled_at AS "cancelledAt",
    a.status AS attendance, s.starts_at AS "startsAt"
  FROM bookings b
  JOIN users u ON u.id = b.user_id
  JOIN time_slots s ON s.id = b.time_slot_id
  LEFT JOIN attendances a ON a.booking_id = b.id`;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly schedule: ScheduleService,
    private readonly subscriptions: SubscriptionsService,
    private readonly metrics: ActivityMetricsService,
  ) {}

  // R9: upsert by booking, so staff can correct a mark.
  async mark(bookingId: string, status: AttendanceStatus, staffId: string): Promise<RosterItemDto> {
    await this.dataSource.transaction(async (manager) => {
      const [booking]: { status: BookingStatus; startsAt: Date }[] = await manager.query(
        `SELECT b.status, s.starts_at AS "startsAt" FROM bookings b JOIN time_slots s ON s.id = b.time_slot_id
         WHERE b.id = $1 AND b.deleted_at IS NULL FOR UPDATE OF b`,
        [bookingId],
      );
      if (!booking) throw new AppError('BOOKING_NOT_FOUND');
      if (booking.status !== 'confirmed' || toBusinessDate(booking.startsAt) > businessToday()) {
        throw new AppError('ATTENDANCE_NOT_ALLOWED');
      }
      await manager.query(
        `INSERT INTO attendances (booking_id, status, marked_by, marked_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (booking_id) DO UPDATE
         SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = EXCLUDED.marked_at, updated_at = now()`,
        [bookingId, status, staffId],
      );
    });
    return this.getRosterItem(bookingId);
  }

  // Active bookings first by client name, cancelled ones last.
  async roster(slotId: string, q: PaginationQueryDto): Promise<Paginated<RosterItemDto>> {
    await this.schedule.getSlot(slotId);
    const where = `WHERE b.time_slot_id = $1 AND b.deleted_at IS NULL AND b.status <> 'expired'`;
    const [rows, [{ total }]] = await Promise.all([
      this.dataSource.query(
        `${ROSTER_SELECT} ${where} ORDER BY (b.status = 'cancelled'), u.name, b.created_at LIMIT $2 OFFSET $3`,
        [slotId, q.pageSize, (q.page - 1) * q.pageSize],
      ) as Promise<RosterRow[]>,
      this.dataSource.query(`SELECT count(*)::int AS total FROM bookings b ${where}`, [slotId]) as Promise<{ total: number }[]>,
    ]);
    return toPaginated(await this.toRosterItems(rows), total, q);
  }

  async getRosterItem(bookingId: string): Promise<RosterItemDto> {
    const rows: RosterRow[] = await this.dataSource.query(`${ROSTER_SELECT} WHERE b.id = $1 AND b.deleted_at IS NULL`, [bookingId]);
    if (rows.length === 0) throw new AppError('BOOKING_NOT_FOUND');
    const [item] = await this.toRosterItems(rows);
    return item;
  }

  async countPresentOn(date: string): Promise<number> {
    const [{ count }]: { count: number }[] = await this.dataSource.query(
      `SELECT count(*)::int AS count FROM attendances a
       JOIN bookings b ON b.id = a.booking_id
       JOIN time_slots s ON s.id = b.time_slot_id
       WHERE a.status = 'present' AND b.status = 'confirmed' AND b.deleted_at IS NULL AND s.starts_at BETWEEN $1 AND $2`,
      [businessDayStart(date), businessDayEnd(date)],
    );
    return count;
  }

  // `planName` = the client's Performance plan that covers the slot date.
  private async toRosterItems(rows: RosterRow[]): Promise<RosterItemDto[]> {
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const [plans, lastAttendance] = await Promise.all([
      this.subscriptions.listPerformanceByUsers(userIds),
      this.metrics.lastAttendanceByUsers(userIds),
    ]);
    return rows.map((row) => {
      const date = toBusinessDate(row.startsAt);
      const plan = plans.find((sub) => sub.userId === row.userId && sub.startsOn <= date && sub.endsOn >= date);
      return {
        bookingId: row.bookingId,
        client: { id: row.userId, name: row.userName },
        planName: plan?.planName ?? null,
        lastAttendanceOn: lastAttendance.get(row.userId) ?? null,
        status: row.status,
        attendance: row.attendance,
        cancelledAt: row.cancelledAt?.toISOString() ?? null,
      };
    });
  }
}
