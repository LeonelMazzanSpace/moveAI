import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

// Better Auth `account` model.
@Entity('accounts')
@Unique(['providerId', 'accountId'])
export class AuthAccount {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') userId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user: User;
  @Column('text') accountId: string;
  @Column('text') providerId: string;
  @Column({ type: 'text', nullable: true }) accessToken: string | null;
  @Column({ type: 'text', nullable: true }) refreshToken: string | null;
  @Column({ type: 'text', nullable: true }) idToken: string | null;
  @Column({ type: 'timestamptz', nullable: true }) accessTokenExpiresAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) refreshTokenExpiresAt: Date | null;
  @Column({ type: 'text', nullable: true }) scope: string | null;
  @Column({ type: 'text', nullable: true }) password: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
