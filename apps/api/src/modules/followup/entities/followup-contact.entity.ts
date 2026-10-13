import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { FollowupAlert } from './followup-alert.entity.js';

export type FollowupContactChannel = 'phone' | 'whatsapp' | 'email' | 'in_person';
export type FollowupContactOutcome = 'reached' | 'no_answer' | 'left_message';

@Entity('followup_contacts')
@Check(`"channel" IN ('phone','whatsapp','email','in_person')`)
@Check(`"outcome" IN ('reached','no_answer','left_message')`)
export class FollowupContact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') userId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  @Index() @Column({ type: 'uuid', nullable: true }) alertId: string | null;
  @ManyToOne(() => FollowupAlert, { nullable: true }) @JoinColumn({ name: 'alert_id' }) alert: FollowupAlert | null;
  @Index() @Column('uuid') staffId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'staff_id' }) staff: User;
  @Column('text') channel: FollowupContactChannel;
  @Column('text') outcome: FollowupContactOutcome;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
