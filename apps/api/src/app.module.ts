import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from './common/common.module.js';
import { appConfig } from './config/app.config.js';
import { authConfig } from './config/auth.config.js';
import { databaseConfig } from './config/database.config.js';
import { validate } from './config/env.validation.js';
import { mercadoPagoConfig } from './config/mercado-pago.config.js';
import { schedulerConfig } from './config/scheduler.config.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AgendaModule } from './modules/schedule/agenda.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { FollowupModule } from './modules/followup/followup.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate,
      load: [appConfig, databaseConfig, authConfig, mercadoPagoConfig, schedulerConfig],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CommonModule,
    HealthModule,
    SettingsModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    AgendaModule,
    SubscriptionsModule,
    BookingsModule,
    PaymentsModule,
    FollowupModule,
  ],
})
export class AppModule {}
