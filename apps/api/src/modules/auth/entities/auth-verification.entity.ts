import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Better Auth `verification` model.
@Entity('verifications')
export class AuthVerification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('text') identifier: string;
  @Column('text') value: string;
  @Column('timestamptz') expiresAt: Date;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
