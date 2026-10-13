import { Body, Controller, Get, Injectable, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
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

// D53: starting a checkout is limited per IP (ThrottlerModule options in AppModule); over the limit it answers the
// contract's RATE_LIMITED instead of the throttler's own exception.
@Injectable()
class CheckoutThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(): Promise<void> {
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
