import {
  Check, Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { Professional } from './professional.entity.js';

@Entity('schedule_templates')
@Check(`"service" IN ('performance','rehab','recovery')`)
@Check(`"weekday" BETWEEN 1 AND 7`)
@Check(`"duration_minutes" > 0`)
@Check(`"capacity" > 0`)
@Check(`"service" <> 'rehab' OR ("professional_id" IS NOT NULL AND "capacity" = 1)`)
export class ScheduleTemplate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') service: Service;
  // ISO weekday: 1 = Monday … 7 = Sunday.
  @Column('smallint') weekday: number;
  // Local America/Montevideo time, 'HH:mm:ss'.
  @Column('time') startTime: string;
  @Column('smallint') durationMinutes: number;
  @Column('smallint') capacity: number;
  @Index() @Column({ type: 'uuid', nullable: true }) professionalId: string | null;
  @ManyToOne(() => Professional, { nullable: true }) @JoinColumn({ name: 'professional_id' }) professional: Professional | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ type: 'timestamptz' }) deletedAt: Date | null;
}
