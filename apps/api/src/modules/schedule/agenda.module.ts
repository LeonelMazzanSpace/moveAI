import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '../settings/settings.module.js';
import { StaffProfessionalsController } from './controllers/staff-professionals.controller.js';
import { StaffSlotsController } from './controllers/staff-slots.controller.js';
import { StaffTemplatesController } from './controllers/staff-templates.controller.js';
import { Professional } from './entities/professional.entity.js';
import { ScheduleTemplate } from './entities/schedule-template.entity.js';
import { TimeSlot } from './entities/time-slot.entity.js';
import { GenerateSlotsJob } from './jobs/generate-slots.job.js';
import { ProfessionalsService } from './services/professionals.service.js';
import { ScheduleService } from './services/schedule.service.js';
import { TemplatesService } from './services/templates.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Professional, ScheduleTemplate, TimeSlot]), SettingsModule],
  controllers: [StaffProfessionalsController, StaffTemplatesController, StaffSlotsController],
  providers: [ProfessionalsService, ScheduleService, TemplatesService, GenerateSlotsJob],
  exports: [ScheduleService],
})
export class AgendaModule {}
