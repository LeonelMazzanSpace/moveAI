import { paginateInMemory, toPaginated } from './pagination.js';

describe('pagination', () => {
  it('slices in memory', () => {
    const page = paginateInMemory([1, 2, 3, 4, 5], { page: 2, pageSize: 2 });
    expect(page).toEqual({ items: [3, 4], total: 5, page: 2, pageSize: 2 });
  });

  it('wraps an already sliced page', () => {
    expect(toPaginated(['a'], 7, { page: 3, pageSize: 1 })).toEqual({ items: ['a'], total: 7, page: 3, pageSize: 1 });
  });
});
