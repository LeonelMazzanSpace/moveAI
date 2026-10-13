import { Injectable } from '@nestjs/common';
import { paginateInMemory, type Paginated, type PaginationQueryDto } from '../../../common/http/pagination.js';
import { ActivityMetricsService } from '../../bookings/services/activity-metrics.service.js';
import { BookingsService } from '../../bookings/services/bookings.service.js';
import type { ActivityItemDto } from '../../bookings/models/booking.model.js';
import type { MyStatsDto } from '../../bookings/models/user-metrics.model.js';
import { CheckinsService } from '../../followup/services/checkins.service.js';
import { PaymentsService } from '../../payments/services/payments.service.js';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service.js';
import { buildNotices } from '../domain/notices.js';
import type { NoticeDto } from '../dto/client-responses.js';
import type { ActivityFilter } from '../dto/my-activity.query.js';

const byDateDesc = (a: ActivityItemDto, b: ActivityItemDto): number => Date.parse(b.date) - Date.parse(a.date);

@Injectable()
export class OverviewService {
  constructor(
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
    private readonly metrics: ActivityMetricsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly checkins: CheckinsService,
  ) {}

  // Bookings (attended, cancelled, upcoming) and approved payments of one client, newest first.
  async listActivity(userId: string, type: ActivityFilter): Promise<ActivityItemDto[]> {
    const [bookings, payments] = await Promise.all([
      type === 'payments' ? [] : this.bookings.listActivityForUser(userId),
      type === 'bookings' ? [] : this.payments.listActivityForUser(userId),
    ]);
    return [...bookings, ...payments].sort(byDateDesc);
  }

  async activity(userId: string, type: ActivityFilter, page: PaginationQueryDto): Promise<Paginated<ActivityItemDto>> {
    return paginateInMemory(await this.listActivity(userId, type), page);
  }

  stats(userId: string, today: string): Promise<MyStatsDto> {
    return this.metrics.getMonthlyStats(userId, today);
  }

  async notices(userId: string, today: string): Promise<NoticeDto[]> {
    const [mine, pendingCheckin, lastAnswered] = await Promise.all([
      this.subscriptions.getMySubscriptions(userId, today),
      this.checkins.pendingFor(userId),
      this.checkins.lastAnsweredFor(userId),
    ]);
    return buildNotices({
      today,
      subscription: mine.performance,
      upcomingSubscription: mine.upcomingPerformance,
      pendingCheckin,
      lastAnswered,
      packs: mine.recoveryPacks,
    });
  }
}
