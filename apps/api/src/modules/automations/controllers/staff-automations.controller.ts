import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { Roles } from '../../../common/auth/roles.decorator.js';
import type { JobRunResultDto } from '../models/job.model.js';
import { AutomationsService } from '../services/automations.service.js';

// D24: runs a job right away (demo and support); it runs even with SCHEDULER_ENABLED=false.
@Roles('staff')
@Controller('staff/automations')
export class StaffAutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Post('run/:job')
  @HttpCode(200)
  run(@Param('job') job: string): Promise<JobRunResultDto> {
    return this.automations.run(job, { force: true });
  }
}
