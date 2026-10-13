import { Controller, Get, Query } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import type { Paginated } from '../../../common/http/pagination.js';
import { businessToday } from '../../../common/time/business-time.js';
import type { ActivityItemDto } from '../../bookings/models/booking.model.js';
import type { MyStatsDto } from '../../bookings/models/user-metrics.model.js';
import type { NoticeDto } from '../dto/client-responses.js';
import { MyActivityQuery } from '../dto/my-activity.query.js';
import { OverviewService } from '../services/overview.service.js';

@Roles('client')
@Controller('me')
export class MyOverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get('activity')
  activity(@CurrentUser() user: AuthUser, @Query() query: MyActivityQuery): Promise<Paginated<ActivityItemDto>> {
    return this.overview.activity(user.id, query.type, query);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthUser): Promise<MyStatsDto> {
    return this.overview.stats(user.id, businessToday());
  }

  @Get('notices')
  notices(@CurrentUser() user: AuthUser): Promise<NoticeDto[]> {
    return this.overview.notices(user.id, businessToday());
  }
}
