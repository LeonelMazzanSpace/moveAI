import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { AutoDebitsController } from './auto-debits.controller.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutThrottlerGuard } from './checkout-throttler.guard.js';

// Nest stores route guards on the handler function itself.
const guardsOf = (controller: object, method: string): unknown =>
  Reflect.getMetadata(GUARDS_METADATA, Object.getOwnPropertyDescriptor(controller, method)?.value as object);

// T-062 M-3: every checkout route answers a throttled request the same way, through one guard.
describe('CheckoutThrottlerGuard', () => {
  it('guards the plan, booking and automatic debit checkouts', () => {
    expect(guardsOf(CheckoutController.prototype, 'checkoutPlan')).toEqual([CheckoutThrottlerGuard]);
    expect(guardsOf(CheckoutController.prototype, 'checkoutBooking')).toEqual([CheckoutThrottlerGuard]);
    expect(guardsOf(AutoDebitsController.prototype, 'checkout')).toEqual([CheckoutThrottlerGuard]);
  });
});
