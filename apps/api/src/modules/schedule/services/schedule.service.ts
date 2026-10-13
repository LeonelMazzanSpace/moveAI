import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, IsNull, type EntityManager, type Repository } from 'typeorm';
import { AppError } from '../../../common/errors/app-error.js';
import { businessDateTime } from '../../../common/time/business-time.js';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { buildSlotsFromTemplates, hasValidRehabShape } from '../domain/slot-generation.js';
import { Professional } from '../entities/professional.entity.js';
import { ScheduleTemplate } from '../entities/schedule-template.entity.js';
import { TimeSlot } from '../entities/time-slot.entity.js';
import type { TimeSlotModel } from '../models/time-slot.model.js';
import { ProfessionalsService } from './professionals.service.js';

const MINUTE_MS = 60_000;

const toModel = (slot: TimeSlot, professional: { id: string; name: string } | null): TimeSlotModel => ({
  id: slot.id,
  service: slot.service,
  startsAt: slot.startsAt,
  endsAt: slot.endsAt,
  capacity: slot.capacity,
  professional,
  templateId: slot.templateId,
  cancelledAt: slot.cancelledAt,
});

const professionalOf = (slot: TimeSlot): { id: string; name: string } | null =>
  slot.professional ? { id: slot.professional.id, name: slot.professional.name } : null;

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(TimeSlot) private readonly slots: Repository<TimeSlot>,
    @InjectRepository(ScheduleTemplate) private readonly templates: Repository<ScheduleTemplate>,
    private readonly dataSource: DataSource,
    private readonly professionals: ProfessionalsService,
  ) {}

  // `SELECT … FOR UPDATE` on the slot row only (no join, so the professional row is not locked).
  async lockSlot(manager: EntityManager, slotId: string): Promise<TimeSlotModel> {
    const slot = await this.lockEntity(manager, slotId);
    return toModel(slot, await this.loadProfessional(manager, slot.professionalId));
  }

  async getSlot(slotId: string): Promise<TimeSlotModel> {
    const slot = await this.slots.findOne({ where: { id: slotId }, relations: { professional: true }, withDeleted: true });
    if (!slot) throw new AppError('SLOT_NOT_FOUND');
    return toModel(slot, professionalOf(slot));
  }

  // `from` and `to` are both inclusive, so callers can pass `businessDayStart` / `businessDayEnd`.
  async listSlots(opts: { service?: Service; from: Date; to: Date; includeCancelled?: boolean }): Promise<TimeSlotModel[]> {
    const slots = await this.slots.find({
      where: {
        startsAt: Between(opts.from, opts.to),
        ...(opts.service ? { service: opts.service } : {}),
        ...(opts.includeCancelled ? {} : { cancelledAt: IsNull() }),
      },
      relations: { professional: true },
      withDeleted: true,
      order: { startsAt: 'ASC' },
    });
    return slots.map((slot) => toModel(slot, professionalOf(slot)));
  }

  async cancelSlot(manager: EntityManager, slotId: string): Promise<TimeSlotModel> {
    const slot = await this.lockEntity(manager, slotId);
    if (!slot.cancelledAt) {
      slot.cancelledAt = new Date();
      await manager.getRepository(TimeSlot).save(slot);
    }
    return toModel(slot, await this.loadProfessional(manager, slot.professionalId));
  }

  async updateCapacity(manager: EntityManager, slotId: string, capacity: number): Promise<TimeSlotModel> {
    const slot = await this.lockEntity(manager, slotId);
    if (!Number.isInteger(capacity) || capacity < 1 || !hasValidRehabShape(slot.service, capacity, slot.professionalId)) {
      throw new AppError('TEMPLATE_INVALID');
    }
    slot.capacity = capacity;
    await manager.getRepository(TimeSlot).save(slot);
    return toModel(slot, await this.loadProfessional(manager, slot.professionalId));
  }

  async createSlot(input: {
    service: Service;
    date: string;
    startTime: string;
    durationMinutes: number;
    capacity: number;
    professionalId?: string | null;
  }): Promise<TimeSlotModel> {
    const professionalId = input.professionalId ?? null;
    if (!hasValidRehabShape(input.service, input.capacity, professionalId)) throw new AppError('TEMPLATE_INVALID');
    if (professionalId) await this.professionals.assertExists(professionalId);

    const startsAt = businessDateTime(input.date, input.startTime);
    const saved = await this.slots.save(
      this.slots.create({
        service: input.service,
        startsAt,
        endsAt: new Date(startsAt.getTime() + input.durationMinutes * MINUTE_MS),
        capacity: input.capacity,
        professionalId,
        templateId: null,
        cancelledAt: null,
      }),
    );
    return toModel(saved, await this.loadProfessional(this.dataSource.manager, professionalId));
  }

  // Idempotent: `UQ_time_slots_template_start` ignores slots that already exist. Only future slots are created.
  async generateSlots(fromDate: string, days: number, templateId?: string): Promise<number> {
    const templates = await this.templates.find({ where: { active: true, ...(templateId ? { id: templateId } : {}) } });
    const now = Date.now();
    const specs = buildSlotsFromTemplates(
      templates.map((t) => ({
        id: t.id,
        service: t.service,
        weekday: t.weekday,
        startTime: t.startTime,
        durationMinutes: t.durationMinutes,
        capacity: t.capacity,
        professionalId: t.professionalId,
      })),
      fromDate,
      days,
    ).filter((spec) => spec.startsAt.getTime() > now);
    if (specs.length === 0) return 0;

    const inserted: { id: string }[] = await this.dataSource.query(
      `INSERT INTO time_slots (service, starts_at, ends_at, capacity, professional_id, template_id)
       SELECT * FROM unnest($1::text[], $2::timestamptz[], $3::timestamptz[], $4::smallint[], $5::uuid[], $6::uuid[])
       ON CONFLICT (template_id, starts_at) WHERE template_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        specs.map((s) => s.service),
        specs.map((s) => s.startsAt.toISOString()),
        specs.map((s) => s.endsAt.toISOString()),
        specs.map((s) => s.capacity),
        specs.map((s) => s.professionalId),
        specs.map((s) => s.templateId),
      ],
    );
    return inserted.length;
  }

  private async lockEntity(manager: EntityManager, slotId: string): Promise<TimeSlot> {
    const slot = await manager.getRepository(TimeSlot).findOne({ where: { id: slotId }, lock: { mode: 'pessimistic_write' } });
    if (!slot) throw new AppError('SLOT_NOT_FOUND');
    return slot;
  }

  private async loadProfessional(manager: EntityManager, id: string | null): Promise<{ id: string; name: string } | null> {
    if (!id) return null;
    const professional = await manager.getRepository(Professional).findOne({ where: { id }, withDeleted: true });
    return professional ? { id: professional.id, name: professional.name } : null;
  }
}
