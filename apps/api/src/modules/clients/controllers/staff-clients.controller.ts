import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { AppError } from '../../../common/errors/app-error.js';
import type { Paginated } from '../../../common/http/pagination.js';
import { businessToday } from '../../../common/time/business-time.js';
import type { ClientDetailDto, ClientKpisDto, ClientRowDto, ClientSummaryDto } from '../dto/client-responses.js';
import { CreateClientDto } from '../dto/create-client.dto.js';
import { ListClientsQuery } from '../dto/list-clients.query.js';
import { RehabFollowupDto } from '../dto/rehab-followup.dto.js';
import type { AutoDebitDto } from '../../payments/models/auto-debit.model.js';
import { AutoDebitsService } from '../../payments/services/auto-debits.service.js';
import { ClientsService } from '../services/clients.service.js';

// A malformed debit id can never match one of the client's debits.
const autoDebitParam = new ParseUUIDPipe({ exceptionFactory: () => new AppError('AUTO_DEBIT_NOT_FOUND') });

@Roles('staff')
@Controller('staff/clients')
export class StaffClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly autoDebits: AutoDebitsService,
  ) {}

  @Get()
  list(@Query() query: ListClientsQuery): Promise<Paginated<ClientRowDto>> {
    return this.clients.list(query.q, query.status, query);
  }

  // Declared before `:id` so the literal path is not read as an id.
  @Get('kpis')
  kpis(): Promise<ClientKpisDto> {
    return this.clients.kpis(businessToday());
  }

  @Post()
  create(@Body() dto: CreateClientDto): Promise<ClientRowDto> {
    return this.clients.create(dto);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<ClientDetailDto> {
    return this.clients.detail(id);
  }

  @Patch(':id/rehab-followup')
  setRehabFollowup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RehabFollowupDto): Promise<ClientSummaryDto> {
    return this.clients.setRehabFollowup(id, dto.enabled);
  }

  // D97: what the client already paid stays valid. A debit of another client answers AUTO_DEBIT_NOT_FOUND.
  @Post(':clientId/auto-debits/:id/cancel')
  @HttpCode(200)
  cancelAutoDebit(
    @Param('clientId', autoDebitParam) clientId: string,
    @Param('id', autoDebitParam) id: string,
  ): Promise<AutoDebitDto> {
    return this.autoDebits.cancel({ userId: clientId, id, by: 'staff' });
  }
}
