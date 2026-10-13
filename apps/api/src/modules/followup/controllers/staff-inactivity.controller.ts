import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { StartInactivityDto } from '../dto/start-inactivity.dto.js';
import type { InactivityReasonDto } from '../models/inactivity.model.js';
import { InactivityService } from '../services/inactivity.service.js';

@Roles('staff')
@Controller('staff/clients/:id/inactivity-reasons')
export class StaffInactivityController {
  constructor(private readonly inactivity: InactivityService) {}

  @Post()
  start(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartInactivityDto,
  ): Promise<InactivityReasonDto> {
    return this.inactivity.start(id, user.id, dto);
  }

  @Post('end')
  @HttpCode(200)
  end(@Param('id', ParseUUIDPipe) id: string): Promise<InactivityReasonDto> {
    return this.inactivity.end(id);
  }
}
