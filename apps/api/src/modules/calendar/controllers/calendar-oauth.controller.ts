import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { CalendarConnectionService } from '../services/calendar-connection.service.js';

// Google sends the browser back here with the API session cookie. Google also adds its own query params (scope,
// authuser…), so they are read one by one instead of through a whitelisted DTO.
@Roles('staff')
@Controller('calendar/oauth')
export class CalendarOAuthController {
  constructor(private readonly connection: CalendarConnectionService) {}

  @Get('callback')
  async callback(
    @CurrentUser() user: AuthUser,
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Query('error') error: unknown,
    @Res() res: Response,
  ): Promise<void> {
    res.redirect(302, await this.connection.completeConnect(user.id, { code, state, error }));
  }
}
