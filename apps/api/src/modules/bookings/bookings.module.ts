import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AgendaModule } from '../schedule/agenda.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { UsersModule } from '../users/users.module.js';
import { AvailabilityController } from './controllers/availability.controller.js';
import { BookingsController } from './controllers/bookings.controller.js';
import { StaffBookingsController } from './controllers/staff-bookings.controller.js';
import { StaffTimeSlotsController } from './controllers/staff-time-slots.controller.js';
import { ExpireHoldsJob } from './jobs/expire-holds.job.js';
import { ActivityMetricsService } from './services/activity-metrics.service.js';
import { AttendanceService } from './services/attendance.service.js';
import { BookingsService } from './services/bookings.service.js';
import { SlotStatsService } from './services/slot-stats.service.js';

@Module({
  imports: [SettingsModule, NotificationsModule, UsersModule, AgendaModule, SubscriptionsModule],
  controllers: [AvailabilityController, BookingsController, StaffTimeSlotsController, StaffBookingsController],
  providers: [BookingsService, AttendanceService, SlotStatsService, ActivityMetricsService, ExpireHoldsJob],
  exports: [BookingsService, AttendanceService, SlotStatsService, ActivityMetricsService, ExpireHoldsJob],
})
export class BookingsModule {}
