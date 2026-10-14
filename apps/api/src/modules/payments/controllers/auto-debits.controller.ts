import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { AppError } from '../../../common/errors/app-error.js';
import { CheckoutAutoDebitDto } from '../dto/auto-debit-checkout.dto.js';
import type { AutoDebitCheckoutDto, AutoDebitDto, AutoDebitStatusDto } from '../models/auto-debit.model.js';
import { AutoDebitsService } from '../services/auto-debits.service.js';
import { CheckoutThrottlerGuard } from './checkout-throttler.guard.js';

// A malformed id or reference can never match a debit, so it is a plain "not found".
const autoDebitParam = new ParseUUIDPipe({ exceptionFactory: () => new AppError('AUTO_DEBIT_NOT_FOUND') });

// D96/D97: the client side of the automatic debit. Staff cancels from the client detail (clients module).
@Roles('client')
@Controller()
export class AutoDebitsController {
  constructor(private readonly autoDebits: AutoDebitsService) {}

  // Same limits and answer as the plan checkout (D53/D58): the `minute` window only.
  @UseGuards(CheckoutThrottlerGuard)
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
