import { Controller, Get, Query } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Public } from '../../../common/auth/public.decorator.js';
import { AvailabilityQuery } from '../dto/availability.query.js';
import { ListTimeSlotsQuery } from '../dto/list-time-slots.query.js';
import type { AvailabilityDayDto, TimeSlotDto } from '../models/booking.model.js';
import { SlotStatsService } from '../services/slot-stats.service.js';

@Public()
@Controller('schedule')
export class AvailabilityController {
  constructor(private readonly slotStats: SlotStatsService) {}

  @Get('time-slots')
  listSlots(@Query() query: ListTimeSlotsQuery, @CurrentUser() user?: AuthUser): Promise<TimeSlotDto[]> {
    return this.slotStats.listPublicSlots(query.service, query.date, user?.id);
  }

  @Get('availability')
  availability(@Query() query: AvailabilityQuery): Promise<AvailabilityDayDto[]> {
    return this.slotStats.availability(query.service, query.from, query.days);
  }
}
