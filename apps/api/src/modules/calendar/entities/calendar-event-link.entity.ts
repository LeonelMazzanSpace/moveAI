import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity.js';

// The Google event MOVE created for a Rehab booking (one per booking).
@Entity('calendar_event_links')
export class CalendarEventLink {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column('uuid') bookingId: string;
  @ManyToOne(() => Booking) @JoinColumn({ name: 'booking_id' }) booking: Booking;
  @Column('text') googleEventId: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
