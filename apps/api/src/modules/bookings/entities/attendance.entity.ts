import {
  Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Booking } from './booking.entity.js';

export type AttendanceStatus = 'present' | 'absent' | 'no_show';

// Attendance is separate from the booking: no row means "Pendiente".
@Entity('attendances')
@Check(`"status" IN ('present','absent','no_show')`)
export class Attendance {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', unique: true }) bookingId: string;
  @ManyToOne(() => Booking) @JoinColumn({ name: 'booking_id' }) booking: Booking;
  @Column('text') status: AttendanceStatus;
  @Index() @Column('uuid') markedBy: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'marked_by' }) markedByUser: User;
  @Column('timestamptz') markedAt: Date;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
