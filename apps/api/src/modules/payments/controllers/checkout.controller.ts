import {
  Body, Controller, type ExecutionContext, Get, Injectable, Param, ParseUUIDPipe, Post, UseGuards,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Public } from '../../../common/auth/public.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { AppError } from '../../../common/errors/app-error.js';
import { CheckoutBookingDto } from '../dto/checkout-booking.dto.js';
import { CheckoutPlanDto } from '../dto/checkout-plan.dto.js';
import type { CheckoutResponseDto, PurchaseStatusDto } from '../dto/payment-responses.js';
import { CheckoutService } from '../services/checkout.service.js';
import { PaymentsService } from '../services/payments.service.js';

// A malformed reference can never match a purchase, so it is a plain "not found".
const externalReference = new ParseUUIDPipe({ exceptionFactory: () => new AppError('PURCHASE_NOT_FOUND') });

// D53/D58: starting a checkout is limited per IP (ThrottlerModule options in AppModule: a `minute` window for both
// routes and an `hour` window for bookings only); over a limit it answers the contract's RATE_LIMITED instead of the
// throttler's own exception. Named windows only get a `Retry-After-<name>` header, so the standard one is set here.
@Injectable()
class CheckoutThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    context.switchToHttp().getResponse<Response>().header('Retry-After', String(detail.timeToBlockExpire));
    throw new AppError('RATE_LIMITED');
  }
}

@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly payments: PaymentsService,
  ) {}

  @Roles('client')
  @UseGuards(CheckoutThrottlerGuard)
  @SkipThrottle({ hour: true })
  @Post('plan')
  checkoutPlan(@CurrentUser() user: AuthUser, @Body() dto: CheckoutPlanDto): Promise<CheckoutResponseDto> {
    return this.checkout.checkoutPlan(user.id, dto.planId);
  }

  @Public()
  @UseGuards(CheckoutThrottlerGuard)
  @Post('booking')
  checkoutBooking(@CurrentUser() user: AuthUser | undefined, @Body() dto: CheckoutBookingDto): Promise<CheckoutResponseDto> {
    return this.checkout.checkoutBooking(user, dto);
  }

  @Public()
  @Get('purchases/:externalReference')
  purchaseStatus(@Param('externalReference', externalReference) ref: string): Promise<PurchaseStatusDto> {
    return this.payments.getPurchaseStatus(ref);
  }
}
