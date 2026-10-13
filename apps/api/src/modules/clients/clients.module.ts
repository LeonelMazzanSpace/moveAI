import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { FollowupModule } from '../followup/followup.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { UsersModule } from '../users/users.module.js';
import { MyOverviewController } from './controllers/my-overview.controller.js';
import { StaffClientsController } from './controllers/staff-clients.controller.js';
import { StaffDashboardController } from './controllers/staff-dashboard.controller.js';
import { ClientsService } from './services/clients.service.js';
import { OverviewService } from './services/overview.service.js';

@Module({
  imports: [SettingsModule, UsersModule, AuthModule, SubscriptionsModule, BookingsModule, PaymentsModule, FollowupModule],
  controllers: [StaffClientsController, StaffDashboardController, MyOverviewController],
  providers: [ClientsService, OverviewService],
})
export class ClientsModule {}
