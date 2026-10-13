import { IsIn, IsOptional } from 'class-validator';

export type BookingScope = 'upcoming' | 'past';

export class MyBookingsQuery {
  @IsOptional()
  @IsIn(['upcoming', 'past'])
  scope: BookingScope = 'upcoming';
}
