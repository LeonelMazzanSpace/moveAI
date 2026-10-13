import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { CreateBookingDto } from '../dto/create-booking.dto.js';
import { MyBookingsQuery } from '../dto/my-bookings.query.js';
import type { BookingDto } from '../models/booking.model.js';
import { BookingsService } from '../services/bookings.service.js';

@Roles('client')
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('bookings')
  book(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto): Promise<BookingDto> {
    return this.bookings.book(user.id, dto.timeSlotId);
  }

  @Get('me/bookings')
  listMine(@CurrentUser() user: AuthUser, @Query() query: MyBookingsQuery): Promise<BookingDto[]> {
    return this.bookings.listForUser(user.id, query.scope);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<BookingDto> {
    return this.bookings.cancelByClient(user.id, id);
  }
}
