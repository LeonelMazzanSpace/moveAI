import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto, paginateInMemory, toPaginated } from './pagination.js';

const errorsFor = (query: Record<string, string>) => validate(plainToInstance(PaginationQueryDto, query));

describe('pagination', () => {
  it('slices in memory', () => {
    const page = paginateInMemory([1, 2, 3, 4, 5], { page: 2, pageSize: 2 });
    expect(page).toEqual({ items: [3, 4], total: 5, page: 2, pageSize: 2 });
  });

  it('wraps an already sliced page', () => {
    expect(toPaginated(['a'], 7, { page: 3, pageSize: 1 })).toEqual({ items: ['a'], total: 7, page: 3, pageSize: 1 });
  });

  it('bounds page so the offset never overflows the database', async () => {
    expect(await errorsFor({ page: '1e20' })).not.toHaveLength(0);
    expect(await errorsFor({ page: '10001' })).not.toHaveLength(0);
    expect(await errorsFor({ page: '10000' })).toHaveLength(0);
  });
});
