import { addDays, businessDateTime, isoWeekday } from '../../../common/time/business-time.js';
import type { Service } from '../../catalog/entities/plan.entity.js';

export interface TemplateSpec {
  id: string;
  service: Service;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  professionalId: string | null;
}

export interface SlotSpec {
  templateId: string;
  service: Service;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  professionalId: string | null;
}

const MINUTE_MS = 60_000;

// One slot per template for every date in [fromDate, fromDate + days) whose ISO weekday matches.
export function buildSlotsFromTemplates(templates: TemplateSpec[], fromDate: string, days: number): SlotSpec[] {
  const slots: SlotSpec[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(fromDate, offset);
    const weekday = isoWeekday(date);
    for (const template of templates) {
      if (template.weekday !== weekday) continue;
      const startsAt = businessDateTime(date, template.startTime);
      slots.push({
        templateId: template.id,
        service: template.service,
        startsAt,
        endsAt: new Date(startsAt.getTime() + template.durationMinutes * MINUTE_MS),
        capacity: template.capacity,
        professionalId: template.professionalId,
      });
    }
  }
  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

// Rehab slots and templates belong to one professional and hold exactly one booking.
export function hasValidRehabShape(service: Service, capacity: number, professionalId: string | null): boolean {
  return service !== 'rehab' || (professionalId !== null && capacity === 1);
}
