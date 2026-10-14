import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Response } from 'express';
import { AppError } from '../../../common/errors/app-error.js';

// D53/D58: starting a checkout is limited per IP (ThrottlerModule options in AppModule: a `minute` window for every
// checkout and an `hour` window for bookings only); over a limit it answers the contract's RATE_LIMITED instead of the
// throttler's own exception. Named windows only get a `Retry-After-<name>` header, so the standard one is set here.
@Injectable()
export class CheckoutThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    context.switchToHttp().getResponse<Response>().header('Retry-After', String(detail.timeToBlockExpire));
    throw new AppError('RATE_LIMITED');
  }
}
