import {
  Check, Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

export type StoredConnectionStatus = 'connected' | 'needs_reconnect';

// D94: the single Google account MOVE syncs with (at most one row not deleted). The refresh token is stored
// encrypted (AES-256-GCM, `iv:tag:ciphertext`), never in clear.
// M-8: the database enforces the single row with a unique index on a constant where `deleted_at IS NULL`. TypeORM cannot
// describe that index, so its migration is written by hand and `synchronize: false` keeps schema diffs from dropping it.
@Entity('calendar_connections')
@Index('UQ_calendar_connections_single_active', { synchronize: false })
@Check(`"status" IN ('connected','needs_reconnect')`)
export class CalendarConnection {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') googleAccountEmail: string;
  @Column({ type: 'text', nullable: true }) calendarId: string | null;
  @Column({ type: 'text', nullable: true }) calendarName: string | null;
  @Column('text') refreshTokenEnc: string;
  @Column({ type: 'text', default: 'connected' }) status: StoredConnectionStatus;
  @Column({ type: 'timestamptz', nullable: true }) lastPushAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastPullAt: Date | null;
  @Column({ type: 'text', nullable: true }) lastErrorCode: string | null;
  @Index() @Column('uuid') connectedBy: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'connected_by' }) connectedByUser: User;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ type: 'timestamptz' }) deletedAt: Date | null;
}
