import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  BUSINESS_TZ, businessDayEnd, businessDayStart, businessMonth,
} from '../../../common/time/business-time.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { computeFrequencies, metricsWindowStart } from '../domain/metrics.js';
import type { MyStatsDto, UserMetrics } from '../models/user-metrics.model.js';

interface MetricsRow {
  userId: string;
  presentDates: string[];
  lastAttendanceOn: string | null;
  attendancesThisMonth: number;
  cancellations: number;
  noShows: number;
  rehabCount: number;
  recoveryCount: number;
}

// R10: only `present` attendances of confirmed Performance bookings count as attendances.
const PRESENT_PERFORMANCE = `b.status = 'confirmed' AND a.status = 'present' AND s.service = 'performance'`;
const BUSINESS_DATE = `to_char(s.starts_at AT TIME ZONE $5, 'YYYY-MM-DD')`;

const EMPTY_ROW: Omit<MetricsRow, 'userId'> = {
  presentDates: [],
  lastAttendanceOn: null,
  attendancesThisMonth: 0,
  cancellations: 0,
  noShows: 0,
  rehabCount: 0,
  recoveryCount: 0,
};

@Injectable()
export class ActivityMetricsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  // One query for every user; frequencies are computed in memory over the R10 windows.
  async getMetrics(userIds: string[], today: string): Promise<Map<string, UserMetrics>> {
    const metrics = new Map<string, UserMetrics>();
    if (userIds.length === 0) return metrics;

    const { frequencyRecentWeeks, frequencyBaselineWeeks } = await this.settings.getAll();
    const rows: MetricsRow[] = await this.dataSource.query(
      `SELECT b.user_id AS "userId",
         coalesce(array_agg(${BUSINESS_DATE}) FILTER (WHERE ${PRESENT_PERFORMANCE} AND s.starts_at >= $2 AND s.starts_at <= $3), '{}') AS "presentDates",
         max(${BUSINESS_DATE}) FILTER (WHERE ${PRESENT_PERFORMANCE} AND s.starts_at <= $3) AS "lastAttendanceOn",
         count(*) FILTER (WHERE ${PRESENT_PERFORMANCE} AND s.starts_at >= $4 AND s.starts_at <= $3)::int AS "attendancesThisMonth",
         count(*) FILTER (WHERE b.cancelled_by = 'client')::int AS cancellations,
         count(*) FILTER (WHERE b.status = 'confirmed' AND a.status = 'no_show')::int AS "noShows",
         count(*) FILTER (WHERE b.status = 'confirmed' AND s.service = 'rehab')::int AS "rehabCount",
         count(*) FILTER (WHERE b.status = 'confirmed' AND s.service = 'recovery')::int AS "recoveryCount"
       FROM bookings b
       JOIN time_slots s ON s.id = b.time_slot_id
       LEFT JOIN attendances a ON a.booking_id = b.id
       WHERE b.user_id = ANY($1::uuid[]) AND b.deleted_at IS NULL
       GROUP BY b.user_id`,
      [
        userIds,
        businessDayStart(metricsWindowStart(today, frequencyRecentWeeks, frequencyBaselineWeeks)),
        businessDayEnd(today),
        businessDayStart(`${businessMonth(today)}-01`),
        BUSINESS_TZ,
      ],
    );
    const byUser = new Map(rows.map((row) => [row.userId, row]));

    for (const userId of userIds) {
      const { presentDates, ...counts } = byUser.get(userId) ?? { ...EMPTY_ROW, userId };
      const frequencies = computeFrequencies(presentDates, today, frequencyRecentWeeks, frequencyBaselineWeeks);
      metrics.set(userId, {
        lastAttendanceOn: counts.lastAttendanceOn,
        attendancesThisMonth: counts.attendancesThisMonth,
        cancellations: counts.cancellations,
        noShows: counts.noShows,
        rehabCount: counts.rehabCount,
        recoveryCount: counts.recoveryCount,
        ...frequencies,
        usualFrequencyPerWeek: frequencies.baselineFrequency,
      });
    }
    return metrics;
  }

  async getMonthlyStats(userId: string, today: string): Promise<MyStatsDto> {
    const metrics = (await this.getMetrics([userId], today)).get(userId);
    return {
      month: businessMonth(today),
      attendances: metrics?.attendancesThisMonth ?? 0,
      avgPerWeek: metrics?.frequencyPerWeek ?? 0,
    };
  }

  // R10 `lastAttendanceOn` only, for lists that do not need the rest of the metrics.
  async lastAttendanceByUsers(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const rows: { userId: string; lastAttendanceOn: string }[] = await this.dataSource.query(
      `SELECT b.user_id AS "userId", max(to_char(s.starts_at AT TIME ZONE $2, 'YYYY-MM-DD')) AS "lastAttendanceOn"
       FROM bookings b
       JOIN time_slots s ON s.id = b.time_slot_id
       JOIN attendances a ON a.booking_id = b.id
       WHERE b.user_id = ANY($1::uuid[]) AND b.deleted_at IS NULL AND ${PRESENT_PERFORMANCE}
       GROUP BY b.user_id`,
      [userIds, BUSINESS_TZ],
    );
    return new Map(rows.map((row) => [row.userId, row.lastAttendanceOn]));
  }
}
