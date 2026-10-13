import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { MySubscriptionsController } from './controllers/my-subscriptions.controller.js';
import { SubscriptionsService } from './services/subscriptions.service.js';

@Module({
  imports: [SettingsModule],
  controllers: [MySubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
