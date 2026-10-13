import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/pagination.js';

export const ACTIVITY_FILTERS = ['all', 'bookings', 'payments'] as const;

export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

export class MyActivityQuery extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ACTIVITY_FILTERS)
  type: ActivityFilter = 'all';
}
