import {
  Check, Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Plan } from '../../catalog/entities/plan.entity.js';
import type { Purchase } from '../../payments/entities/purchase.entity.js';
import { User } from '../../users/entities/user.entity.js';

export type SubscriptionService = 'performance' | 'recovery';

@Entity('subscriptions')
@Check(`"service" IN ('performance','recovery')`)
@Check(`"ends_on" >= "starts_on"`)
@Check(`"sessions_used" >= 0 AND ("sessions_total" IS NULL OR "sessions_used" <= "sessions_total")`)
@Index(['userId', 'service', 'endsOn'])
@Index('UQ_subscriptions_purchase', ['purchaseId'], { unique: true, where: `"purchase_id" IS NOT NULL` })
export class Subscription {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
  @Index() @Column('uuid') planId: string;
  @ManyToOne(() => Plan) @JoinColumn({ name: 'plan_id' }) plan: Plan;
  @Column({ type: 'uuid', nullable: true }) purchaseId: string | null;
  // String target: `payments` sits after `subscriptions` in the module order, so no runtime import.
  @ManyToOne('Purchase', { nullable: true }) @JoinColumn({ name: 'purchase_id' }) purchase: Purchase | null;
  @Column('text') service: SubscriptionService;
  @Column('date') startsOn: string;
  @Column('date') endsOn: string;
  @Column({ type: 'smallint', nullable: true }) sessionsTotal: number | null;
  @Column({ type: 'smallint', default: 0 }) sessionsUsed: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ type: 'timestamptz' }) deletedAt: Date | null;
}
