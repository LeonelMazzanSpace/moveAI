import {
  Check, Column, CreateDateColumn, Entity, Generated, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Plan } from '../../catalog/entities/plan.entity.js';
import { User } from '../../users/entities/user.entity.js';

export type AutoDebitService = 'performance' | 'recovery';
export type AutoDebitStatus = 'pending' | 'authorized' | 'cancelled';
export type AutoDebitCancelReason = 'client' | 'staff' | 'provider' | 'expired';
export type AutoDebitFrequencyType = 'months' | 'days';

// D96/D97: a Mercado Pago subscription (preapproval). Each approved charge becomes a purchase with `auto_debit_id`.
@Entity('auto_debits')
@Check(`"service" IN ('performance','recovery')`)
@Check(`"status" IN ('pending','authorized','cancelled')`)
@Check(`"cancel_reason" IS NULL OR "cancel_reason" IN ('client','staff','provider','expired')`)
@Check(`"frequency_type" IN ('months','days')`)
@Check(`"frequency" > 0`)
@Check(`"amount" >= 0`)
@Index('UQ_auto_debits_active_user_service', ['userId', 'service'], {
  unique: true,
  where: `"status" IN ('pending','authorized')`,
})
@Index(['status', 'createdAt'])
export class AutoDebit {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') userId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  @Index() @Column('uuid') planId: string;
  @ManyToOne(() => Plan) @JoinColumn({ name: 'plan_id' }) plan: Plan;
  @Column('text') service: AutoDebitService;
  @Column({ type: 'uuid', unique: true }) @Generated('uuid') externalReference: string;
  @Column({ type: 'text', nullable: true, unique: true }) mpPreapprovalId: string | null;
  @Column({ type: 'text', default: 'pending' }) status: AutoDebitStatus;
  @Column('integer') amount: number;
  @Column('smallint') frequency: number;
  @Column('text') frequencyType: AutoDebitFrequencyType;
  @Column({ type: 'date', nullable: true }) nextChargeDate: string | null;
  @Column({ type: 'timestamptz', nullable: true }) cancelledAt: Date | null;
  @Column({ type: 'text', nullable: true }) cancelReason: AutoDebitCancelReason | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
