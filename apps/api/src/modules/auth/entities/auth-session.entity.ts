import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

// Better Auth `session` model.
@Entity('sessions')
export class AuthSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') userId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user: User;
  @Column({ type: 'text', unique: true }) token: string;
  @Column('timestamptz') expiresAt: Date;
  @Column({ type: 'text', nullable: true }) ipAddress: string | null;
  @Column({ type: 'text', nullable: true }) userAgent: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
