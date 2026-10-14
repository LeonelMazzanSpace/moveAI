import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { FollowupModule } from '../followup/followup.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { AgendaModule } from '../schedule/agenda.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { UsersModule } from '../users/users.module.js';
import { StaffAutomationsController } from './controllers/staff-automations.controller.js';
import { BookingRemindersJob } from './jobs/booking-reminders.job.js';
import { CheckinsMonthlyJob } from './jobs/checkins-monthly.job.js';
import { ExpiryRemindersJob } from './jobs/expiry-reminders.job.js';
import { FollowupDetectJob } from './jobs/followup-detect.job.js';
import { AutomationsService } from './services/automations.service.js';
import { BookingRemindersService } from './services/booking-reminders.service.js';
import { ExpiryRemindersService } from './services/expiry-reminders.service.js';

@Module({
  imports: [
    SettingsModule, NotificationsModule, UsersModule, AgendaModule, SubscriptionsModule, BookingsModule, PaymentsModule,
    FollowupModule,
  ],
  controllers: [StaffAutomationsController],
  providers: [
    AutomationsService, ExpiryRemindersService, BookingRemindersService, FollowupDetectJob, ExpiryRemindersJob,
    CheckinsMonthlyJob, BookingRemindersJob,
  ],
  exports: [AutomationsService],
})
export class AutomationsModule {}
