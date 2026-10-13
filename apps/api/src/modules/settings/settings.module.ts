import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from './entities/setting.entity.js';
import { SettingsService } from './services/settings.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
