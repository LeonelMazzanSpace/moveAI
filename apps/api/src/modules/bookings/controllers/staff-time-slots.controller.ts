import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { PaginationQueryDto, type Paginated } from '../../../common/http/pagination.js';
import { businessToday } from '../../../common/time/business-time.js';
import { ListStaffTimeSlotsQuery } from '../dto/list-staff-time-slots.query.js';
import { UpdateSlotCapacityDto } from '../dto/update-slot-capacity.dto.js';
import type { RosterItemDto, StaffTimeSlotDto } from '../models/booking.model.js';
import { AttendanceService } from '../services/attendance.service.js';
import { SlotStatsService } from '../services/slot-stats.service.js';

@Roles('staff')
@Controller('staff/time-slots')
export class StaffTimeSlotsController {
  constructor(
    private readonly slotStats: SlotStatsService,
    private readonly attendance: AttendanceService,
  ) {}

  @Get()
  list(@Query() query: ListStaffTimeSlotsQuery): Promise<StaffTimeSlotDto[]> {
    return this.slotStats.listStaffSlots(query.date, query.service);
  }

  @Get('pending-attendance')
  pendingAttendance(): Promise<StaffTimeSlotDto[]> {
    return this.slotStats.pendingAttendanceSlots(businessToday());
  }

  @Get(':id/roster')
  roster(@Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationQueryDto): Promise<Paginated<RosterItemDto>> {
    return this.attendance.roster(id, query);
  }

  @Patch(':id')
  updateCapacity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSlotCapacityDto): Promise<StaffTimeSlotDto> {
    return this.slotStats.updateCapacity(id, dto.capacity);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string): Promise<StaffTimeSlotDto> {
    return this.slotStats.cancelSlot(id);
  }
}
