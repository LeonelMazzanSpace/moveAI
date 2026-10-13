import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { User } from '../../users/entities/user.entity.js';

export type SettingValue = number | boolean;

@Entity('settings')
export class Setting {
  @PrimaryColumn('text') key: string;
  @Column('jsonb') value: SettingValue;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
  @Index() @Column({ type: 'uuid', nullable: true }) updatedBy: string | null;
  // String target: `users` sits after `settings` in the module order, so no runtime import.
  @ManyToOne('User', { nullable: true }) @JoinColumn({ name: 'updated_by' }) updatedByUser: User | null;
}
