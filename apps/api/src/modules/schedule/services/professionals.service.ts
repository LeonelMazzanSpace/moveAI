import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { Professional } from '../entities/professional.entity.js';
import type { ProfessionalModel } from '../models/professional.model.js';

const toModel = ({ id, name, active }: Professional): ProfessionalModel => ({ id, name, active });

@Injectable()
export class ProfessionalsService {
  constructor(@InjectRepository(Professional) private readonly professionals: Repository<Professional>) {}

  async list(): Promise<ProfessionalModel[]> {
    return (await this.professionals.find({ order: { name: 'ASC', createdAt: 'ASC' } })).map(toModel);
  }

  async create(input: { name: string }): Promise<ProfessionalModel> {
    return toModel(await this.professionals.save(this.professionals.create({ name: input.name })));
  }

  // A key present with `undefined` (an optional DTO field) means "not patched".
  async update(id: string, patch: { name?: string; active?: boolean }): Promise<ProfessionalModel> {
    const professional = await this.professionals.findOne({ where: { id } });
    if (!professional) throw new AppError('PROFESSIONAL_NOT_FOUND');
    if (patch.name !== undefined) professional.name = patch.name;
    if (patch.active !== undefined) professional.active = patch.active;
    return toModel(await this.professionals.save(professional));
  }

  // An inactive professional cannot be assigned: it is answered like a missing one (D42).
  async assertAssignable(id: string): Promise<void> {
    if (!(await this.professionals.exists({ where: { id, active: true } }))) throw new AppError('PROFESSIONAL_NOT_FOUND');
  }
}
