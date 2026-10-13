import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../../common/auth/roles.decorator.js';
import type { Paginated } from '../../../common/http/pagination.js';
import { businessToday } from '../../../common/time/business-time.js';
import type { ClientDetailDto, ClientKpisDto, ClientRowDto, ClientSummaryDto } from '../dto/client-responses.js';
import { CreateClientDto } from '../dto/create-client.dto.js';
import { ListClientsQuery } from '../dto/list-clients.query.js';
import { RehabFollowupDto } from '../dto/rehab-followup.dto.js';
import { ClientsService } from '../services/clients.service.js';

@Roles('staff')
@Controller('staff/clients')
export class StaffClientsController {
  constructor(private readonly clients: ClientsService) {}

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
}
