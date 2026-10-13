import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, type Repository, type SelectQueryBuilder } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { businessToday } from '../../../common/time/business-time.js';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { hasValidRehabShape } from '../domain/slot-generation.js';
import { ScheduleTemplate } from '../entities/schedule-template.entity.js';
import type { ScheduleTemplateModel } from '../models/time-slot.model.js';
import { ProfessionalsService } from './professionals.service.js';
import { ScheduleService } from './schedule.service.js';

export interface CreateTemplateInput {
  service: Service;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  professionalId?: string | null;
}

export interface UpdateTemplateInput {
  startTime?: string;
  durationMinutes?: number;
  capacity?: number;
  professionalId?: string | null;
  active?: boolean;
}

const toModel = (template: ScheduleTemplate): ScheduleTemplateModel => ({
  id: template.id,
  service: template.service,
  weekday: template.weekday,
  startTime: template.startTime.slice(0, 5),
  durationMinutes: template.durationMinutes,
  capacity: template.capacity,
  professionalId: template.professionalId,
  professionalName: template.professional?.name ?? null,
  active: template.active,
});

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(ScheduleTemplate) private readonly templates: Repository<ScheduleTemplate>,
    private readonly professionals: ProfessionalsService,
    private readonly schedule: ScheduleService,
    private readonly settings: SettingsService,
    private readonly dataSource: DataSource,
  ) {}

  async list(service?: Service): Promise<ScheduleTemplateModel[]> {
    const query = this.withProfessional();
    if (service) query.andWhere('template.service = :service', { service });
    const templates = await query
      .orderBy('template.weekday', 'ASC')
      .addOrderBy('template.startTime', 'ASC')
      .addOrderBy('template.createdAt', 'ASC')
      .getMany();
    return templates.map(toModel);
  }

  async create(input: CreateTemplateInput): Promise<ScheduleTemplateModel> {
    const professionalId = input.professionalId ?? null;
    if (!hasValidRehabShape(input.service, input.capacity, professionalId)) throw new AppError('TEMPLATE_INVALID');
    if (professionalId) await this.professionals.assertAssignable(professionalId);

    const windowDays = await this.settings.get('bookingWindowDays');
    const id = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ScheduleTemplate);
      const saved = await repository.save(
        repository.create({
          service: input.service,
          weekday: input.weekday,
          startTime: input.startTime,
          durationMinutes: input.durationMinutes,
          capacity: input.capacity,
          professionalId,
          active: true,
        }),
      );
      await this.generateWithinWindow(manager, saved.id, windowDays);
      return saved.id;
    });
    return this.get(id);
  }

  // Editing only changes what is generated from now on: slots that already exist are left as they are.
  async update(id: string, patch: UpdateTemplateInput): Promise<ScheduleTemplateModel> {
    const template = await this.templates.findOne({ where: { id } });
    if (!template) throw new AppError('TEMPLATE_NOT_FOUND');

    const next = {
      startTime: patch.startTime ?? template.startTime,
      durationMinutes: patch.durationMinutes ?? template.durationMinutes,
      capacity: patch.capacity ?? template.capacity,
      professionalId: patch.professionalId === undefined ? template.professionalId : patch.professionalId,
      active: patch.active ?? template.active,
    };
    if (!hasValidRehabShape(template.service, next.capacity, next.professionalId)) throw new AppError('TEMPLATE_INVALID');
    if (next.professionalId && next.professionalId !== template.professionalId) {
      await this.professionals.assertAssignable(next.professionalId);
    }

    const windowDays = await this.settings.get('bookingWindowDays');
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ScheduleTemplate).update({ id }, next);
      await this.generateWithinWindow(manager, id, windowDays);
    });
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.templates.softDelete({ id });
    if (!result.affected) throw new AppError('TEMPLATE_NOT_FOUND');
  }

  private async get(id: string): Promise<ScheduleTemplateModel> {
    const template = await this.withProfessional().andWhere('template.id = :id', { id }).getOne();
    if (!template) throw new AppError('TEMPLATE_NOT_FOUND');
    return toModel(template);
  }

  // Live templates with their professional, even when that professional was soft-deleted.
  private withProfessional(): SelectQueryBuilder<ScheduleTemplate> {
    return this.templates
      .createQueryBuilder('template')
      .withDeleted()
      .leftJoinAndSelect('template.professional', 'professional')
      .where('template.deletedAt IS NULL');
  }

  // The bookable window covers today through `today + bookingWindowDays`, both included.
  private async generateWithinWindow(manager: EntityManager, templateId: string, windowDays: number): Promise<void> {
    await this.schedule.generateSlots(businessToday(), windowDays + 1, templateId, manager);
  }
}
