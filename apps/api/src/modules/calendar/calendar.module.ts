import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { calendarConfig } from '../../config/calendar.config.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { CalendarOAuthController } from './controllers/calendar-oauth.controller.js';
import { StaffCalendarController } from './controllers/staff-calendar.controller.js';
import { CalendarConnection } from './entities/calendar-connection.entity.js';
import { CalendarPullJob } from './jobs/calendar-pull.job.js';
import { CalendarPushJob } from './jobs/calendar-push.job.js';
import { CalendarConnectionService } from './services/calendar-connection.service.js';
import { CalendarSyncService } from './services/calendar-sync.service.js';
import { GoogleCalendarService } from './services/google-calendar.service.js';

// D94: last module of the chain (… → automations → calendar); nothing imports it. Bookings and slots are read with SQL
// and only `time_slots.calendar_blocked_at` is written.
// `CalendarEventLink` is only read and written with SQL, so it is not registered here: its relation points to `Booking`,
// which no module registers with `forFeature`, and @nestjs/typeorm keeps those registrations across re-imports of
// AppModule (health.e2e-spec). The migration CLI still loads it by file glob.
@Module({
  imports: [
    ConfigModule.forFeature(calendarConfig),
    TypeOrmModule.forFeature([CalendarConnection]),
    SettingsModule,
    NotificationsModule,
  ],
  controllers: [StaffCalendarController, CalendarOAuthController],
  providers: [GoogleCalendarService, CalendarConnectionService, CalendarSyncService, CalendarPushJob, CalendarPullJob],
})
export class CalendarModule {}
