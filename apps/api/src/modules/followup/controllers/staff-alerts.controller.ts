import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { CreateContactDto } from '../dto/create-contact.dto.js';
import { ListAlertsQuery } from '../dto/list-alerts.query.js';
import type { AlertCountsDto, AlertDto } from '../models/alert.model.js';
import type { ContactDto } from '../models/contact.model.js';
import { AlertsService } from '../services/alerts.service.js';
import { ContactsService } from '../services/contacts.service.js';

@Roles('staff')
@Controller('staff/alerts')
export class StaffAlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly contacts: ContactsService,
  ) {}

  @Get('counts')
  counts(): Promise<AlertCountsDto> {
    return this.alerts.counts();
  }

  @Get()
  list(@Query() query: ListAlertsQuery): Promise<AlertDto[]> {
    return this.alerts.list({ type: query.type, status: query.status });
  }

  @Post(':id/contacts')
  createContact(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateContactDto,
  ): Promise<ContactDto> {
    return this.contacts.create(id, user.id, dto);
  }

  @Post(':id/handle')
  @HttpCode(200)
  handle(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<AlertDto> {
    return this.alerts.handle(id, user.id);
  }
}
