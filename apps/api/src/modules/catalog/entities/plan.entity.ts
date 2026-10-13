import {
  Check, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

export type Service = 'performance' | 'rehab' | 'recovery';
export type PlanKind = 'period_plan' | 'session_pack' | 'single_session' | 'evaluation';

@Entity('plans')
@Check(`"service" IN ('performance','rehab','recovery')`)
@Check(`"kind" IN ('period_plan','session_pack','single_session','evaluation')`)
@Check(`"price" >= 0`)
@Check(`"kind" <> 'period_plan' OR ("service" = 'performance' AND "period_months" IS NOT NULL AND "period_months" > 0)`)
@Check(`"kind" <> 'session_pack' OR ("service" = 'recovery' AND "period_days" IS NOT NULL AND "period_days" > 0 AND "sessions_included" IS NOT NULL AND "sessions_included" > 0)`)
@Check(`"kind" <> 'single_session' OR ("service" = 'recovery' AND "duration_minutes" IS NOT NULL AND "duration_minutes" > 0)`)
@Check(`"kind" <> 'evaluation' OR ("service" = 'rehab' AND "duration_minutes" IS NOT NULL AND "duration_minutes" > 0)`)
export class Plan {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') service: Service;
  @Column('text') kind: PlanKind;
  @Column({ type: 'text', unique: true }) slug: string;
  @Column('text') name: string;
  @Column({ type: 'text', default: '' }) description: string;
  @Column({ type: 'text', array: true, default: '{}' }) features: string[];
  @Column('integer') price: number;
  @Column({ type: 'smallint', nullable: true }) periodMonths: number | null;
  @Column({ type: 'smallint', nullable: true }) periodDays: number | null;
  @Column({ type: 'smallint', nullable: true }) sessionsIncluded: number | null;
  @Column({ type: 'smallint', nullable: true }) durationMinutes: number | null;
  @Column({ type: 'boolean', default: false }) featured: boolean;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'smallint', default: 0 }) sortOrder: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ type: 'timestamptz' }) deletedAt: Date | null;
}
