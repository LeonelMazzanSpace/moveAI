import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { Public } from '../../../common/auth/public.decorator.js';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { AppError } from '../../../common/errors/app-error.js';
import { UpdateContactDto } from '../dto/update-contact.dto.js';
import { UpdateSettingsDto } from '../dto/update-settings.dto.js';
import type { ContactInfo, StaffContactInfo } from '../models/contact-info.model.js';
import type { SettingsValues } from '../models/settings.model.js';
import { InvalidSettingsError, SettingsService } from '../services/settings.service.js';

@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('settings/public')
  async getPublic(): Promise<Pick<SettingsValues, 'cancelLimitHours' | 'bookingWindowDays'>> {
    const { cancelLimitHours, bookingWindowDays } = await this.settingsService.getAll();
    return { cancelLimitHours, bookingWindowDays };
  }

  @Public()
  @Get('settings/contact')
  async getPublicContact(): Promise<ContactInfo> {
    const { address, hours, whatsapp, instagram, email, mapsUrl } = await this.settingsService.getContact();
    return { address, hours, whatsapp, instagram, email, mapsUrl };
  }

  @Roles('staff')
  @Get('staff/settings/contact')
  getContact(): Promise<StaffContactInfo> {
    return this.settingsService.getContact();
  }

  @Roles('staff')
  @Patch('staff/settings/contact')
  updateContact(@Body() dto: UpdateContactDto, @CurrentUser() staff: AuthUser): Promise<StaffContactInfo> {
    return this.settingsService.updateContact(dto, staff.id);
  }

  @Roles('staff')
  @Get('staff/settings')
  getAll(): Promise<SettingsValues> {
    return this.settingsService.getAll();
  }

  @Roles('staff')
  @Patch('staff/settings')
  async update(@Body() dto: UpdateSettingsDto, @CurrentUser() staff: AuthUser): Promise<SettingsValues> {
    try {
      return await this.settingsService.update(dto, staff.id);
    } catch (error) {
      if (error instanceof InvalidSettingsError) throw new AppError('SETTINGS_INVALID');
      throw error;
    }
  }
}
