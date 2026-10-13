import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { Roles } from '../../../common/auth/roles.decorator.js';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { CreateTemplateDto } from '../dto/create-template.dto.js';
import { SERVICES } from '../dto/schedule-fields.js';
import { UpdateTemplateDto } from '../dto/update-template.dto.js';
import type { ScheduleTemplateModel } from '../models/time-slot.model.js';
import { TemplatesService } from '../services/templates.service.js';

class ListTemplatesQuery {
  @IsOptional()
  @IsIn(SERVICES)
  service?: Service;
}

@Roles('staff')
@Controller('staff/schedule/templates')
export class StaffTemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(@Query() query: ListTemplatesQuery): Promise<ScheduleTemplateModel[]> {
    return this.templates.list(query.service);
  }

  @Post()
  create(@Body() dto: CreateTemplateDto): Promise<ScheduleTemplateModel> {
    return this.templates.create({
      service: dto.service,
      weekday: dto.weekday,
      startTime: dto.startTime,
      durationMinutes: dto.durationMinutes,
      capacity: dto.capacity,
      professionalId: dto.professionalId,
    });
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateDto): Promise<ScheduleTemplateModel> {
    return this.templates.update(id, {
      startTime: dto.startTime,
      durationMinutes: dto.durationMinutes,
      capacity: dto.capacity,
      professionalId: dto.professionalId,
      active: dto.active,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.templates.remove(id);
  }
}
