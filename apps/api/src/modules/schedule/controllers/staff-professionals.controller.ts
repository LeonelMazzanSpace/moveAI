import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../../../common/auth/roles.decorator.js';
import { CreateProfessionalDto } from '../dto/create-professional.dto.js';
import { UpdateProfessionalDto } from '../dto/update-professional.dto.js';
import type { ProfessionalModel } from '../models/professional.model.js';
import { ProfessionalsService } from '../services/professionals.service.js';

@Roles('staff')
@Controller('staff/professionals')
export class StaffProfessionalsController {
  constructor(private readonly professionals: ProfessionalsService) {}

  @Get()
  list(): Promise<ProfessionalModel[]> {
    return this.professionals.list();
  }

  @Post()
  create(@Body() dto: CreateProfessionalDto): Promise<ProfessionalModel> {
    return this.professionals.create({ name: dto.name });
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProfessionalDto): Promise<ProfessionalModel> {
    return this.professionals.update(id, { name: dto.name, active: dto.active });
  }
}
