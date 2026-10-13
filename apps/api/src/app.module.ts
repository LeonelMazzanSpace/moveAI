import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module.js';
import { appConfig } from './config/app.config.js';
import { authConfig } from './config/auth.config.js';
import { databaseConfig } from './config/database.config.js';
import { validate } from './config/env.validation.js';
import { mercadoPagoConfig } from './config/mercado-pago.config.js';
import { schedulerConfig } from './config/scheduler.config.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate,
      load: [appConfig, databaseConfig, authConfig, mercadoPagoConfig, schedulerConfig],
    }),
    DatabaseModule,
    CommonModule,
    HealthModule,
  ],
})
export class AppModule {}
