import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { businessToday } from '../../../common/time/business-time.js';
import type { MySubscriptionsDto } from '../models/subscription.model.js';
import { SubscriptionsService } from '../services/subscriptions.service.js';

@Controller('me/subscriptions')
@Roles('client')
export class MySubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  getMine(@CurrentUser() user: AuthUser): Promise<MySubscriptionsDto> {
    return this.subscriptionsService.getMySubscriptions(user.id, businessToday());
  }
}
