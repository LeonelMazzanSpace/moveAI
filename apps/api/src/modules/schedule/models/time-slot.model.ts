import type { Service } from '../../catalog/entities/plan.entity.js';

export interface TimeSlotModel {
  id: string;
  service: Service;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  professional: { id: string; name: string } | null;
  templateId: string | null;
  cancelledAt: Date | null;
}

// Same shape as `ScheduleTemplateDto`; `startTime` is local Montevideo 'HH:mm'.
export interface ScheduleTemplateModel {
  id: string;
  service: Service;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  professionalId: string | null;
  professionalName: string | null;
  active: boolean;
}
