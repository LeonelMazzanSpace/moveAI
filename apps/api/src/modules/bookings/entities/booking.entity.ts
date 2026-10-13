import {
  Check, Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { TimeSlot } from '../../schedule/entities/time-slot.entity.js';
import { Subscription } from '../../subscriptions/entities/subscription.entity.js';
import { User } from '../../users/entities/user.entity.js';

export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'expired';
export type BookingSource = 'plan' | 'package' | 'payment' | 'followup';

@Entity('bookings')
@Check(`"status" IN ('pending_payment','confirmed','cancelled','expired')`)
@Check(`"source" IN ('plan','package','payment','followup')`)
@Check(`"cancelled_by" IS NULL OR "cancelled_by" IN ('client','staff','system')`)
@Index('UQ_bookings_active_user_slot', ['userId', 'timeSlotId'], {
  unique: true,
  where: `"status" IN ('pending_payment','confirmed') AND "deleted_at" IS NULL`,
})
@Index(['timeSlotId', 'status'])
@Index(['userId', 'status'])
export class Booking {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  @Column('uuid') timeSlotId: string;
  @ManyToOne(() => TimeSlot) @JoinColumn({ name: 'time_slot_id' }) timeSlot: TimeSlot;
  @Column('text') status: BookingStatus;
  @Column('text') source: BookingSource;
  @Index() @Column({ type: 'uuid', nullable: true }) subscriptionId: string | null;
  @ManyToOne(() => Subscription, { nullable: true }) @JoinColumn({ name: 'subscription_id' }) subscription: Subscription | null;
  @Column({ type: 'timestamptz', nullable: true }) holdExpiresAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) confirmedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) cancelledAt: Date | null;
  @Column({ type: 'text', nullable: true }) cancelledBy: 'client' | 'staff' | 'system' | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ type: 'timestamptz' }) deletedAt: Date | null;
}
