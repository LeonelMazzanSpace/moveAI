import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { AnswerCheckinDto } from '../dto/answer-checkin.dto.js';
import type { CheckinFlag, PendingCheckinDto } from '../models/checkin.model.js';
import { CheckinsService } from '../services/checkins.service.js';

@Roles('client')
@Controller('me/checkins')
export class MyCheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Get('pending')
  async pending(@CurrentUser() user: AuthUser): Promise<{ checkin: PendingCheckinDto | null }> {
    return { checkin: await this.checkins.pendingFor(user.id) };
  }

  @Post(':id')
  answer(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswerCheckinDto,
  ): Promise<{ flag: CheckinFlag }> {
    return this.checkins.answer(user.id, id, dto);
  }
}
