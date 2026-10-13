import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { MarkAttendanceDto } from '../dto/mark-attendance.dto.js';
import type { RosterItemDto } from '../models/booking.model.js';
import { AttendanceService } from '../services/attendance.service.js';
import { BookingsService } from '../services/bookings.service.js';

@Roles('staff')
@Controller('staff/bookings')
export class StaffBookingsController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly bookings: BookingsService,
  ) {}

  @Put(':id/attendance')
  mark(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkAttendanceDto,
  ): Promise<RosterItemDto> {
    return this.attendance.mark(id, dto.status, user.id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string): Promise<RosterItemDto> {
    return this.bookings.cancelByStaff(id);
  }
}
