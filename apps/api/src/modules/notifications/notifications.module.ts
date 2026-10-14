import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { brevoConfig } from '../../config/brevo.config.js';
import { SettingsModule } from '../settings/settings.module.js';
import { EmailLog } from './entities/email-log.entity.js';
import { BrevoService } from './services/brevo.service.js';
import { NotificationsService } from './services/notifications.service.js';

@Module({
  imports: [ConfigModule.forFeature(brevoConfig), TypeOrmModule.forFeature([EmailLog]), SettingsModule],
  providers: [BrevoService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
