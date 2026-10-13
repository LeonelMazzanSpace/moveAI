import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { businessMonth, businessToday } from '../../../common/time/business-time.js';
import { CheckinResponsesQuery, CheckinStatsQuery } from '../dto/checkins.query.js';
import type { CheckinResponseDto, CheckinStatsDto } from '../models/checkin.model.js';
import { CheckinsService } from '../services/checkins.service.js';

const currentPeriod = (): string => businessMonth(businessToday());

@Roles('staff')
@Controller('staff/checkins')
export class StaffCheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Post('send')
  send(): Promise<{ sent: number; period: string }> {
    return this.checkins.send(currentPeriod());
  }

  @Get('stats')
  stats(@Query() query: CheckinStatsQuery): Promise<CheckinStatsDto> {
    return this.checkins.stats(query.period ?? currentPeriod());
  }

  @Get('responses')
  responses(@Query() query: CheckinResponsesQuery): Promise<CheckinResponseDto[]> {
    return this.checkins.responses({ period: query.period ?? currentPeriod(), flag: query.flag });
  }

  @Post(':id/refer-rehab')
  @HttpCode(200)
  referRehab(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<CheckinResponseDto> {
    return this.checkins.referRehab(id, user.id);
  }
}
