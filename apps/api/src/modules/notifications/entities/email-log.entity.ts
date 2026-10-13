import { Check, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type EmailLogStatus = 'pending' | 'sent' | 'failed' | 'skipped';

@Entity('email_logs')
@Check(`"status" IN ('pending','sent','failed','skipped')`)
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  idempotencyKey: string;

  @Column({ type: 'text' })
  template: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'text' })
  status: EmailLogStatus;

  @Column({ type: 'text', nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'text', nullable: true })
  errorCode: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;
}
