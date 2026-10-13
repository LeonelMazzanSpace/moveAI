import {
  Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export type FollowupAlertType =
  | 'expiring'
  | 'expired'
  | 'no_attendance'
  | 'prolonged_inactivity'
  | 'frequency_drop'
  | 'recontact'
  | 'checkin_pain'
  | 'checkin_goals';
export type FollowupAlertStatus = 'open' | 'handled';

@Entity('followup_alerts')
@Check(
  `"type" IN ('expiring','expired','no_attendance','prolonged_inactivity','frequency_drop','recontact','checkin_pain','checkin_goals')`,
)
@Check(`"status" IN ('open','handled')`)
@Unique('UQ_followup_alerts_key', ['userId', 'type', 'periodKey'])
@Index(['status', 'type'])
export class FollowupAlert {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  @Column('text') type: FollowupAlertType;
  @Column('text') periodKey: string;
  @Column({ type: 'text', default: 'open' }) status: FollowupAlertStatus;
  @Column({ type: 'jsonb', default: {} }) context: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) handledAt: Date | null;
  @Index() @Column({ type: 'uuid', nullable: true }) handledBy: string | null;
  @ManyToOne(() => User, { nullable: true }) @JoinColumn({ name: 'handled_by' }) handledByUser: User | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
