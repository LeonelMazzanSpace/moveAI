import {
  Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export type InactivityReasonCode = 'injury' | 'vacation' | 'temporary_pause' | 'no_time' | 'moving' | 'return_later';

// A client is paused while a reason has no `ended_at` (at most one per client).
@Entity('inactivity_reasons')
@Check(`"reason" IN ('injury','vacation','temporary_pause','no_time','moving','return_later')`)
@Index('UQ_inactivity_reasons_active_user', ['userId'], { unique: true, where: `"ended_at" IS NULL` })
export class InactivityReason {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') userId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  @Column('text') reason: InactivityReasonCode;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'date', nullable: true }) recontactOn: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) startedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) endedAt: Date | null;
  @Index() @Column('uuid') createdBy: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'created_by' }) createdByUser: User;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
