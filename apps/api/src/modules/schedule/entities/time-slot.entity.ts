import {
  Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { Professional } from './professional.entity.js';
import { ScheduleTemplate } from './schedule-template.entity.js';

// Concrete slots are never soft-deleted: they are cancelled (`cancelled_at`).
@Entity('time_slots')
@Check(`"service" IN ('performance','rehab','recovery')`)
@Check(`"ends_at" > "starts_at"`)
@Check(`"capacity" > 0`)
@Check(`"service" <> 'rehab' OR ("professional_id" IS NOT NULL AND "capacity" = 1)`)
@Index(['service', 'startsAt'])
@Index('UQ_time_slots_template_start', ['templateId', 'startsAt'], {
  unique: true,
  where: `"template_id" IS NOT NULL`,
})
export class TimeSlot {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') service: Service;
  @Column('timestamptz') startsAt: Date;
  @Column('timestamptz') endsAt: Date;
  @Column('smallint') capacity: number;
  @Index() @Column({ type: 'uuid', nullable: true }) professionalId: string | null;
  @ManyToOne(() => Professional, { nullable: true }) @JoinColumn({ name: 'professional_id' }) professional: Professional | null;
  @Column({ type: 'uuid', nullable: true }) templateId: string | null;
  @ManyToOne(() => ScheduleTemplate, { nullable: true }) @JoinColumn({ name: 'template_id' }) template: ScheduleTemplate | null;
  @Column({ type: 'timestamptz', nullable: true }) cancelledAt: Date | null;
  // D94: busy in the connected Google Calendar (written by the calendar module); not bookable while set.
  @Index({ where: `"calendar_blocked_at" IS NOT NULL` })
  @Column({ type: 'timestamptz', nullable: true }) calendarBlockedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
