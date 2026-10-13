import 'reflect-metadata';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export interface Paginated<T> { items: T[]; total: number; page: number; pageSize: number }

export function toPaginated<T>(items: T[], total: number, q: PaginationQueryDto): Paginated<T> {
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export function paginateInMemory<T>(all: T[], q: PaginationQueryDto): Paginated<T> {
  const start = (q.page - 1) * q.pageSize;
  return toPaginated(all.slice(start, start + q.pageSize), all.length, q);
}
