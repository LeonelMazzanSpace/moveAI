import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { UsersModule } from '../users/users.module.js';
import { MyCheckinsController } from './controllers/my-checkins.controller.js';
import { StaffAlertsController } from './controllers/staff-alerts.controller.js';
import { StaffCheckinsController } from './controllers/staff-checkins.controller.js';
import { StaffInactivityController } from './controllers/staff-inactivity.controller.js';
import { AlertsService } from './services/alerts.service.js';
import { CheckinsService } from './services/checkins.service.js';
import { ContactsService } from './services/contacts.service.js';
import { InactivityService } from './services/inactivity.service.js';

@Module({
  imports: [SettingsModule, NotificationsModule, UsersModule, SubscriptionsModule, BookingsModule],
  controllers: [StaffAlertsController, StaffInactivityController, StaffCheckinsController, MyCheckinsController],
  providers: [AlertsService, InactivityService, ContactsService, CheckinsService],
  exports: [AlertsService, InactivityService, ContactsService, CheckinsService],
})
export class FollowupModule {}
