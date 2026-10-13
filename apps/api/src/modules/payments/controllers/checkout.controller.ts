import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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

@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly payments: PaymentsService,
  ) {}

  @Roles('client')
  @Post('plan')
  checkoutPlan(@CurrentUser() user: AuthUser, @Body() dto: CheckoutPlanDto): Promise<CheckoutResponseDto> {
    return this.checkout.checkoutPlan(user.id, dto.planId);
  }

  @Public()
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
