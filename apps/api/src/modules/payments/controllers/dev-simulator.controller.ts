import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../../../common/auth/public.decorator.js';
import type { PurchaseStatusDto } from '../dto/payment-responses.js';
import { SimulatePaymentDto } from '../dto/simulate-payment.dto.js';
import { PaymentsService } from '../services/payments.service.js';

// D4: answers NOT_FOUND unless the simulator is enabled (no MP_ACCESS_TOKEN and not production).
@Public()
@Controller('payments/dev')
export class DevSimulatorController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('simulate')
  @HttpCode(200)
  simulate(@Body() dto: SimulatePaymentDto): Promise<PurchaseStatusDto> {
    return this.payments.simulate(dto.externalReference, dto.outcome);
  }
}
