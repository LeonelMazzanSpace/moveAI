import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import type { Paginated } from '../../../common/http/pagination.js';
import { ListStaffPaymentsQuery } from '../dto/list-staff-payments.query.js';
import { ManualPaymentDto } from '../dto/manual-payment.dto.js';
import type { StaffPaymentDto } from '../dto/payment-responses.js';
import { PaymentsService } from '../services/payments.service.js';

@Roles('staff')
@Controller('staff/payments')
export class StaffPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query() query: ListStaffPaymentsQuery): Promise<Paginated<StaffPaymentDto>> {
    return this.payments.listStaffPayments(query);
  }

  @Post('manual')
  recordManual(@CurrentUser() user: AuthUser, @Body() dto: ManualPaymentDto): Promise<StaffPaymentDto> {
    return this.payments.recordManualPayment(user.id, dto);
  }
}
