import {
  Check, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'client' | 'staff';

// Better Auth `user` model (see the Better Auth mapping in the auth module).
@Entity('users')
@Check(`"role" IN ('client','staff')`)
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') name: string;
  @Column({ type: 'text', unique: true }) email: string;
  @Column({ type: 'boolean', default: false }) emailVerified: boolean;
  @Column({ type: 'text', nullable: true }) image: string | null;
  @Column({ type: 'text', default: 'client' }) role: UserRole;
  @Column({ type: 'text', nullable: true }) phone: string | null;
  @Column({ type: 'boolean', default: false }) rehabFollowupEnabled: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ type: 'timestamptz' }) deletedAt: Date | null;
}
