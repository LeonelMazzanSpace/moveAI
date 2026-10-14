import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import {
  addDays, businessDayEnd, businessDayStart, businessToday, toBusinessDate,
} from '../../../common/time/business-time.js';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { ScheduleService } from '../../schedule/services/schedule.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { isBookable } from '../domain/booking-rules.js';
import type { AvailabilityDayDto, StaffTimeSlotDto, TimeSlotDto } from '../models/booking.model.js';

// R9: past slots with confirmed bookings still unmarked are flagged for this many days.
const PENDING_ATTENDANCE_DAYS = 14;

interface SlotStatsRow {
  id: string;
  service: Service;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  cancelledAt: Date | null;
  calendarBlockedAt: Date | null;
  professionalId: string | null;
  professionalName: string | null;
  booked: number;
  present: number;
  absent: number;
  noShow: number;
  cancelled: number;
  pendingAttendance: number;
  bookedByMe: boolean;
}

// One aggregated query per list: `$1` is the viewer (or null) and the filters use `$2…`.
// `pendingAttendance` only counts slots that already started.
const slotStatsSql = (where: string, having = 'true') => `
  SELECT s.id, s.service, s.starts_at AS "startsAt", s.ends_at AS "endsAt", s.capacity, s.cancelled_at AS "cancelledAt",
    s.calendar_blocked_at AS "calendarBlockedAt", p.id AS "professionalId", p.name AS "professionalName",
    count(b.id) FILTER (WHERE b.status IN ('pending_payment','confirmed'))::int AS booked,
    count(b.id) FILTER (WHERE b.status = 'confirmed' AND a.status = 'present')::int AS present,
    count(b.id) FILTER (WHERE b.status = 'confirmed' AND a.status = 'absent')::int AS absent,
    count(b.id) FILTER (WHERE b.status = 'confirmed' AND a.status = 'no_show')::int AS "noShow",
    count(b.id) FILTER (WHERE b.status = 'cancelled')::int AS cancelled,
    count(b.id) FILTER (WHERE b.status = 'confirmed' AND a.id IS NULL AND s.starts_at <= now())::int AS "pendingAttendance",
    coalesce(bool_or(b.user_id = $1::uuid AND b.status IN ('pending_payment','confirmed')), false) AS "bookedByMe"
  FROM time_slots s
  LEFT JOIN professionals p ON p.id = s.professional_id
  LEFT JOIN bookings b ON b.time_slot_id = s.id AND b.deleted_at IS NULL
  LEFT JOIN attendances a ON a.booking_id = b.id
  WHERE ${where}
  GROUP BY s.id, p.id
  HAVING ${having}
  ORDER BY s.starts_at, s.created_at`;

const professionalOf = (row: SlotStatsRow) =>
  row.professionalId && row.professionalName ? { id: row.professionalId, name: row.professionalName } : null;

const freeSpots = (row: SlotStatsRow): number => Math.max(0, row.capacity - row.booked);

const toPublicSlot = (row: SlotStatsRow): TimeSlotDto => ({
  id: row.id,
  service: row.service,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt.toISOString(),
  capacity: row.capacity,
  booked: row.booked,
  available: freeSpots(row),
  isFull: row.booked >= row.capacity,
  professional: professionalOf(row),
  bookedByMe: row.bookedByMe,
});

const toStaffSlot = (row: SlotStatsRow): StaffTimeSlotDto => ({
  id: row.id,
  service: row.service,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt.toISOString(),
  capacity: row.capacity,
  professional: professionalOf(row),
  cancelledAt: row.cancelledAt?.toISOString() ?? null,
  booked: row.booked,
  present: row.present,
  absent: row.absent,
  noShow: row.noShow,
  cancelled: row.cancelled,
  pendingAttendance: row.pendingAttendance,
  calendarBlocked: row.calendarBlockedAt !== null,
  calendarConflict: row.calendarBlockedAt !== null && row.booked > 0,
});

@Injectable()
export class SlotStatsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly schedule: ScheduleService,
    private readonly settings: SettingsService,
  ) {}

  // Slots busy in Google Calendar (D94) are hidden like cancelled ones.
  async listPublicSlots(service: Service, date: string, viewerId?: string): Promise<TimeSlotDto[]> {
    const rows = await this.query(
      `s.service = $2 AND s.starts_at BETWEEN $3 AND $4 AND s.cancelled_at IS NULL AND s.calendar_blocked_at IS NULL`,
      [service, businessDayStart(date), businessDayEnd(date)],
      viewerId,
    );
    return rows.map(toPublicSlot);
  }

  // One item per day; `available` sums the free spots of the slots that can still be booked.
  async availability(service: Service, from: string, days: number): Promise<AvailabilityDayDto[]> {
    const to = addDays(from, days - 1);
    const [rows, windowDays] = await Promise.all([
      this.query(`s.service = $2 AND s.starts_at BETWEEN $3 AND $4 AND s.cancelled_at IS NULL AND s.calendar_blocked_at IS NULL`, [
        service, businessDayStart(from), businessDayEnd(to),
      ]),
      this.settings.get('bookingWindowDays'),
    ]);
    const now = new Date();
    const today = businessToday(now);
    const byDate = new Map<string, number>();
    for (const row of rows) {
      if (!isBookable(row, now, today, windowDays)) continue;
      const date = toBusinessDate(row.startsAt);
      byDate.set(date, (byDate.get(date) ?? 0) + freeSpots(row));
    }
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      return { date, available: byDate.get(date) ?? 0 };
    });
  }

  async listStaffSlots(date: string, service?: Service): Promise<StaffTimeSlotDto[]> {
    const params: unknown[] = [businessDayStart(date), businessDayEnd(date)];
    const serviceFilter = service ? ` AND s.service = $${params.push(service) + 1}` : '';
    const rows = await this.query(`s.starts_at BETWEEN $2 AND $3${serviceFilter}`, params);
    return rows.map(toStaffSlot);
  }

  // R9: started slots of the last days with a confirmed booking that has no attendance yet.
  async pendingAttendanceSlots(today: string): Promise<StaffTimeSlotDto[]> {
    const rows = await this.query(
      `s.cancelled_at IS NULL AND s.starts_at >= $2 AND s.starts_at <= now()`,
      [businessDayStart(addDays(today, -PENDING_ATTENDANCE_DAYS))],
      undefined,
      `count(b.id) FILTER (WHERE b.status = 'confirmed' AND a.id IS NULL) > 0`,
    );
    return rows.map(toStaffSlot);
  }

  async countSlotsOn(date: string): Promise<number> {
    const [{ count }]: { count: number }[] = await this.dataSource.query(
      `SELECT count(*)::int AS count FROM time_slots WHERE cancelled_at IS NULL AND starts_at BETWEEN $1 AND $2`,
      [businessDayStart(date), businessDayEnd(date)],
    );
    return count;
  }

  async getStaffSlot(slotId: string, manager: EntityManager = this.dataSource.manager): Promise<StaffTimeSlotDto> {
    const [row] = await this.query(`s.id = $2`, [slotId], undefined, 'true', manager);
    if (!row) throw new AppError('SLOT_NOT_FOUND');
    return toStaffSlot(row);
  }

  // Active = `pending_payment` or `confirmed`. Call it after locking the slot so the count cannot change underneath.
  async countActive(manager: EntityManager, slotId: string): Promise<number> {
    const [{ count }]: { count: number }[] = await manager.query(
      `SELECT count(*)::int AS count FROM bookings
       WHERE time_slot_id = $1 AND status IN ('pending_payment','confirmed') AND deleted_at IS NULL`,
      [slotId],
    );
    return count;
  }

  // D94. Read it after locking the slot, so a mark written by a concurrent calendar pull is already visible.
  async calendarBlockedAt(manager: EntityManager, slotId: string): Promise<Date | null> {
    const [row]: { calendarBlockedAt: Date | null }[] = await manager.query(
      `SELECT calendar_blocked_at AS "calendarBlockedAt" FROM time_slots WHERE id = $1`,
      [slotId],
    );
    return row?.calendarBlockedAt ?? null;
  }

  async updateCapacity(slotId: string, capacity: number): Promise<StaffTimeSlotDto> {
    await this.dataSource.transaction(async (manager) => {
      await this.schedule.lockSlot(manager, slotId);
      if (capacity < (await this.countActive(manager, slotId))) throw new AppError('CAPACITY_BELOW_BOOKED');
      await this.schedule.updateCapacity(manager, slotId, capacity);
    });
    return this.getStaffSlot(slotId);
  }

  async cancelSlot(slotId: string): Promise<StaffTimeSlotDto> {
    await this.dataSource.transaction(async (manager) => {
      await this.schedule.lockSlot(manager, slotId);
      if ((await this.countActive(manager, slotId)) > 0) throw new AppError('SLOT_HAS_BOOKINGS');
      await this.schedule.cancelSlot(manager, slotId);
    });
    return this.getStaffSlot(slotId);
  }

  private query(
    where: string,
    params: unknown[],
    viewerId?: string,
    having?: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<SlotStatsRow[]> {
    return manager.query(slotStatsSql(where, having), [viewerId ?? null, ...params]);
  }
}
