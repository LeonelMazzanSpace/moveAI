import {
  Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Purchase } from './purchase.entity.js';

export type PaymentStatus = 'pending' | 'in_process' | 'approved' | 'rejected' | 'cancelled' | 'refunded';

// Processor operations (Mercado Pago) or manual records.
@Entity('payments')
@Check(`"status" IN ('pending','in_process','approved','rejected','cancelled','refunded')`)
export class Payment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') purchaseId: string;
  @ManyToOne(() => Purchase) @JoinColumn({ name: 'purchase_id' }) purchase: Purchase;
  @Column({ type: 'text', nullable: true, unique: true }) mpPaymentId: string | null;
  @Column('text') status: PaymentStatus;
  @Column({ type: 'text', nullable: true }) statusDetail: string | null;
  @Column('integer') amount: number;
  @Column({ type: 'timestamptz', nullable: true }) appliedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
