import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { schedulerConfig } from '../config/scheduler.config.js';
import { JobRunner } from './scheduling/job-runner.service.js';

@Global()
@Module({
  imports: [ConfigModule.forFeature(schedulerConfig)],
  providers: [JobRunner],
  exports: [JobRunner],
})
export class CommonModule {}
