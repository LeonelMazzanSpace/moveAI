import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../../common/auth/public.decorator.js';
import { ListPlansQuery } from '../dto/list-plans.query.js';
import type { PlanModel } from '../models/plan.model.js';
import { CatalogService } from '../services/catalog.service.js';

@Public()
@Controller('catalog/plans')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list(@Query() query: ListPlansQuery): Promise<PlanModel[]> {
    return this.catalogService.listActive(query.service);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string): Promise<PlanModel> {
    return this.catalogService.findActiveBySlug(slug);
  }
}
