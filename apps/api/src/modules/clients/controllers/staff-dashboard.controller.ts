import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { businessToday } from '../../../common/time/business-time.js';
import type { DashboardDto } from '../dto/client-responses.js';
import { ClientsService } from '../services/clients.service.js';

@Roles('staff')
@Controller('staff/dashboard')
export class StaffDashboardController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  dashboard(): Promise<DashboardDto> {
    return this.clients.dashboard(businessToday());
  }
}
