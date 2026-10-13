import {
  Check, Column, CreateDateColumn, DeleteDateColumn, Entity, Generated, Index, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity.js';
import { Plan } from '../../catalog/entities/plan.entity.js';
import { User } from '../../users/entities/user.entity.js';

export type PurchaseKind = 'plan' | 'booking';
export type PurchaseMethod = 'mercadopago' | 'cash' | 'transfer';
export type PurchaseStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

@Entity('purchases')
@Check(`"kind" IN ('plan','booking')`)
@Check(`"kind" <> 'booking' OR "booking_id" IS NOT NULL`)
@Check(`"amount" >= 0`)
@Check(`"method" IN ('mercadopago','cash','transfer')`)
@Check(`"status" IN ('pending','approved','rejected','cancelled','expired')`)
@Index(['status', 'createdAt'])
export class Purchase {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') userId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  @Column('text') kind: PurchaseKind;
  @Index() @Column('uuid') planId: string;
  @ManyToOne(() => Plan) @JoinColumn({ name: 'plan_id' }) plan: Plan;
  @Index() @Column({ type: 'uuid', nullable: true }) bookingId: string | null;
  @ManyToOne(() => Booking, { nullable: true }) @JoinColumn({ name: 'booking_id' }) booking: Booking | null;
  @Column('integer') amount: number;
  @Column({ type: 'text', default: 'UYU' }) currency: string;
  @Column('text') method: PurchaseMethod;
  @Column({ type: 'text', default: 'pending' }) status: PurchaseStatus;
  @Column({ type: 'uuid', unique: true }) @Generated('uuid') externalReference: string;
  @Column({ type: 'text', nullable: true }) mpPreferenceId: string | null;
  @Column({ type: 'boolean', default: false }) needsAttention: boolean;
  @Index() @Column({ type: 'uuid', nullable: true }) recordedBy: string | null;
  @ManyToOne(() => User, { nullable: true }) @JoinColumn({ name: 'recorded_by' }) recordedByUser: User | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'timestamptz', nullable: true }) approvedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ type: 'timestamptz' }) deletedAt: Date | null;
}
