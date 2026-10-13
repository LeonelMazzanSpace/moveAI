import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { AppError } from '../../../common/errors/app-error.js';
import { CreatePlanDto } from '../dto/create-plan.dto.js';
import { ListStaffPlansQuery } from '../dto/list-plans.query.js';
import { UpdatePlanDto } from '../dto/update-plan.dto.js';
import type { PlanModel } from '../models/plan.model.js';
import { CatalogService } from '../services/catalog.service.js';

// A malformed id can never match a plan, so it is a plain "not found".
const planId = new ParseUUIDPipe({ exceptionFactory: () => new AppError('PLAN_NOT_FOUND') });

@Roles('staff')
@Controller('staff/plans')
export class StaffPlansController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list(@Query() query: ListStaffPlansQuery): Promise<PlanModel[]> {
    return this.catalogService.listForStaff({ service: query.service, includeInactive: query.includeInactive ?? false });
  }

  @Post()
  create(@Body() dto: CreatePlanDto): Promise<PlanModel> {
    return this.catalogService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', planId) id: string, @Body() dto: UpdatePlanDto): Promise<PlanModel> {
    return this.catalogService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', planId) id: string): Promise<void> {
    return this.catalogService.remove(id);
  }
}
