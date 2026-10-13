import {
  Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export type CheckinStatus = 'sent' | 'answered';
export type CheckinFeeling = 'struggling' | 'good' | 'very_good';
export type CheckinPain = 'none' | 'mild';
export type CheckinGoals = 'same' | 'adjust';
export type CheckinFlag = 'ok' | 'pain' | 'goals';

@Entity('checkins')
@Check(`"status" IN ('sent','answered')`)
@Check(`"feeling" IS NULL OR "feeling" IN ('struggling','good','very_good')`)
@Check(`"pain" IS NULL OR "pain" IN ('none','mild')`)
@Check(`"goals" IS NULL OR "goals" IN ('same','adjust')`)
@Check(`"flag" IS NULL OR "flag" IN ('ok','pain','goals')`)
@Unique(['userId', 'period'])
export class Checkin {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  // Business month 'YYYY-MM' (America/Montevideo).
  @Column('text') period: string;
  @Column({ type: 'text', default: 'sent' }) status: CheckinStatus;
  @Column({ type: 'timestamptz', default: () => 'now()' }) sentAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) respondedAt: Date | null;
  @Column({ type: 'text', nullable: true }) feeling: CheckinFeeling | null;
  @Column({ type: 'text', nullable: true }) pain: CheckinPain | null;
  @Column({ type: 'text', nullable: true }) painDetail: string | null;
  @Column({ type: 'text', nullable: true }) goals: CheckinGoals | null;
  @Column({ type: 'text', nullable: true }) goalsDetail: string | null;
  @Column({ type: 'text', nullable: true }) flag: CheckinFlag | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
