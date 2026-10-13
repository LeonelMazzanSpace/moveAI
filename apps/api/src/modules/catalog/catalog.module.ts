import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './controllers/catalog.controller.js';
import { StaffPlansController } from './controllers/staff-plans.controller.js';
import { Plan } from './entities/plan.entity.js';
import { CatalogService } from './services/catalog.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Plan])],
  controllers: [CatalogController, StaffPlansController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
