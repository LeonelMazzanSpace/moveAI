import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { SelectCalendarDto } from '../dto/select-calendar.dto.js';
import { CalendarPullJob } from '../jobs/calendar-pull.job.js';
import { CalendarPushJob } from '../jobs/calendar-push.job.js';
import type { CalendarStatusDto, GoogleCalendarOptionDto } from '../models/calendar-status.model.js';
import { CalendarConnectionService } from '../services/calendar-connection.service.js';

@Roles('staff')
@Controller('staff/calendar')
export class StaffCalendarController {
  constructor(
    private readonly connection: CalendarConnectionService,
    private readonly pushJob: CalendarPushJob,
    private readonly pullJob: CalendarPullJob,
  ) {}

  @Get()
  status(): Promise<CalendarStatusDto> {
    return this.connection.getStatus();
  }

  @Post('connect')
  @HttpCode(200)
  connect(@CurrentUser() user: AuthUser): { authUrl: string } {
    return this.connection.startConnect(user.id);
  }

  @Get('calendars')
  calendars(): Promise<GoogleCalendarOptionDto[]> {
    return this.connection.listCalendars();
  }

  @Patch()
  select(@Body() dto: SelectCalendarDto): Promise<CalendarStatusDto> {
    return this.connection.selectCalendar(dto.calendarId);
  }

  // Runs both jobs now, under the same locks as the crons.
  @Post('sync')
  @HttpCode(200)
  async sync(): Promise<CalendarStatusDto> {
    await this.pushJob.execute({ force: true });
    await this.pullJob.execute({ force: true });
    return this.connection.getStatus();
  }

  @Delete()
  disconnect(): Promise<CalendarStatusDto> {
    return this.connection.disconnect();
  }
}
