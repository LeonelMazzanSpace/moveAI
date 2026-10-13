import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { QueryFailedError, Repository, type FindOptionsWhere } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import type { CreatePlanDto } from '../dto/create-plan.dto.js';
import { PLAN_LIMITS } from '../dto/create-plan.dto.js';
import type { UpdatePlanDto } from '../dto/update-plan.dto.js';
import { SLUG_PATTERN, validatePlanShape } from '../domain/plan-rules.js';
import { Plan, type Service } from '../entities/plan.entity.js';
import { toPlanDto, type PlanModel } from '../models/plan.model.js';

const UNIQUE_VIOLATION = '23505';

// A key present with `undefined` (an optional DTO field) means "not patched", never "clear it".
function definedFields<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<T>;
}

// The only unique column besides the primary key is `slug`.
function rethrowSlugTaken(error: unknown): never {
  const code = error instanceof QueryFailedError ? (error.driverError as { code?: string }).code : undefined;
  if (code === UNIQUE_VIOLATION) throw new AppError('SLUG_TAKEN');
  throw error;
}

@Injectable()
export class CatalogService {
  constructor(@InjectRepository(Plan) private readonly plans: Repository<Plan>) {}

  listActive(service?: Service): Promise<PlanModel[]> {
    return this.list({ service, includeInactive: false });
  }

  listForStaff(opts: { service?: Service; includeInactive: boolean }): Promise<PlanModel[]> {
    return this.list(opts);
  }

  async findById(id: string, opts: { includeInactive?: boolean } = {}): Promise<PlanModel> {
    if (!isUUID(id)) throw new AppError('PLAN_NOT_FOUND');
    const where: FindOptionsWhere<Plan> = opts.includeInactive ? { id } : { id, active: true };
    const plan = await this.plans.findOneBy(where);
    if (!plan) throw new AppError('PLAN_NOT_FOUND');
    return toPlanDto(plan);
  }

  async findActiveBySlug(slug: string): Promise<PlanModel> {
    // Rejects NUL bytes and oversized values before they reach Postgres.
    if (slug.length > PLAN_LIMITS.slugMax || !SLUG_PATTERN.test(slug)) throw new AppError('PLAN_NOT_FOUND');
    const plan = await this.plans.findOneBy({ slug, active: true });
    if (!plan) throw new AppError('PLAN_NOT_FOUND');
    return toPlanDto(plan);
  }

  async create(dto: CreatePlanDto): Promise<PlanModel> {
    const shape = {
      service: dto.service,
      kind: dto.kind,
      periodMonths: dto.periodMonths ?? null,
      periodDays: dto.periodDays ?? null,
      sessionsIncluded: dto.sessionsIncluded ?? null,
      durationMinutes: dto.durationMinutes ?? null,
    };
    validatePlanShape(shape);
    const plan = this.plans.create({
      ...shape,
      slug: dto.slug,
      name: dto.name,
      description: dto.description ?? '',
      features: dto.features ?? [],
      price: dto.price,
      featured: dto.featured ?? false,
      active: dto.active ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    try {
      return toPlanDto(await this.plans.save(plan));
    } catch (error) {
      return rethrowSlugTaken(error);
    }
  }

  async update(id: string, dto: UpdatePlanDto): Promise<PlanModel> {
    const changes = definedFields(dto);
    try {
      return await this.plans.manager.transaction(async (manager) => {
        const repository = manager.getRepository(Plan);
        // The row lock makes the shape check run against the stored values of concurrent edits.
        const plan = await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!plan) throw new AppError('PLAN_NOT_FOUND');
        validatePlanShape({
          service: plan.service,
          kind: plan.kind,
          periodMonths: changes.periodMonths ?? plan.periodMonths,
          periodDays: changes.periodDays ?? plan.periodDays,
          sessionsIncluded: changes.sessionsIncluded ?? plan.sessionsIncluded,
          durationMinutes: changes.durationMinutes ?? plan.durationMinutes,
        });
        return toPlanDto(await repository.save(repository.merge(plan, changes)));
      });
    } catch (error) {
      return rethrowSlugTaken(error);
    }
  }

  async remove(id: string): Promise<void> {
    if (!isUUID(id)) throw new AppError('PLAN_NOT_FOUND');
    const plan = await this.plans.findOneBy({ id });
    if (!plan) throw new AppError('PLAN_NOT_FOUND');
    await this.plans.softRemove(plan);
  }

  private async list(opts: { service?: Service; includeInactive: boolean }): Promise<PlanModel[]> {
    const where: FindOptionsWhere<Plan> = {
      ...(opts.service ? { service: opts.service } : {}),
      ...(opts.includeInactive ? {} : { active: true }),
    };
    const plans = await this.plans.find({ where, order: { service: 'ASC', sortOrder: 'ASC', name: 'ASC' } });
    return plans.map(toPlanDto);
  }
}
