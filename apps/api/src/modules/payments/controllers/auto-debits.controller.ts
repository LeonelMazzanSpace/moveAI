import {
  Body, Controller, type ExecutionContext, Get, HttpCode, Injectable, Param, ParseUUIDPipe, Post, UseGuards,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { AppError } from '../../../common/errors/app-error.js';
import { CheckoutAutoDebitDto } from '../dto/auto-debit-checkout.dto.js';
import type { AutoDebitCheckoutDto, AutoDebitDto, AutoDebitStatusDto } from '../models/auto-debit.model.js';
import { AutoDebitsService } from '../services/auto-debits.service.js';

// A malformed id or reference can never match a debit, so it is a plain "not found".
const autoDebitParam = new ParseUUIDPipe({ exceptionFactory: () => new AppError('AUTO_DEBIT_NOT_FOUND') });

// Same limits and answer as the checkout controller (D53/D58): the `minute` window, RATE_LIMITED and Retry-After.
@Injectable()
class AutoDebitThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    context.switchToHttp().getResponse<Response>().header('Retry-After', String(detail.timeToBlockExpire));
    throw new AppError('RATE_LIMITED');
  }
}

// D96/D97: the client side of the automatic debit. Staff cancels from the client detail (clients module).
@Roles('client')
@Controller()
export class AutoDebitsController {
  constructor(private readonly autoDebits: AutoDebitsService) {}

  @UseGuards(AutoDebitThrottlerGuard)
  @SkipThrottle({ hour: true })
  @Post('checkout/auto-debit')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutAutoDebitDto): Promise<AutoDebitCheckoutDto> {
    return this.autoDebits.checkout(user.id, dto.planSlug);
  }

  @Get('checkout/auto-debits/:externalReference')
  status(@CurrentUser() user: AuthUser, @Param('externalReference', autoDebitParam) ref: string): Promise<AutoDebitStatusDto> {
    return this.autoDebits.getStatus(user.id, ref);
  }

  @Get('me/auto-debits')
  list(@CurrentUser() user: AuthUser): Promise<AutoDebitDto[]> {
    return this.autoDebits.listForUser(user.id);
  }

  @Post('me/auto-debits/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', autoDebitParam) id: string): Promise<AutoDebitDto> {
    return this.autoDebits.cancel({ userId: user.id, id, by: 'client' });
  }
}
