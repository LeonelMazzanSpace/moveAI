import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { CurrentUser } from '../../../common/auth/current-user.decorator.js';
import { AppError } from '../../../common/errors/app-error.js';
import { UpdateMeDto } from '../dto/update-me.dto.js';
import type { MeDto } from '../models/user.model.js';
import { UsersService } from '../services/users.service.js';

// Auth `any`: the global AuthGuard rejects anonymous requests before reaching these handlers.
@Controller('me')
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getMe(@CurrentUser() authUser: AuthUser): Promise<MeDto> {
    const user = await this.usersService.findById(authUser.id);
    if (!user) throw new AppError('UNAUTHENTICATED');
    return this.usersService.toMeDto(user);
  }

  @Patch()
  async updateMe(@CurrentUser() authUser: AuthUser, @Body() dto: UpdateMeDto): Promise<MeDto> {
    const user = await this.usersService.updateProfile(authUser.id, { name: dto.name, phone: dto.phone });
    return this.usersService.toMeDto(user);
  }
}
