import { notFound } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { PlanDto } from '@/lib/api/types';

const serverApiFetch = vi.fn();
vi.mock('@/lib/api/server', () => ({ serverApiFetch }));

const { loadPlans } = await import('./load-plans');

const plans = [{ id: 'p1', slug: 'performance-mensual' }] as PlanDto[];

describe('loadPlans', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requests the catalog for the service and returns the plans', async () => {
    serverApiFetch.mockResolvedValue(plans);

    await expect(loadPlans('performance')).resolves.toBe(plans);
    expect(serverApiFetch).toHaveBeenCalledWith('/catalog/plans', { query: { service: 'performance' } });
  });

  it('degrades to an empty list when the API fails', async () => {
    serverApiFetch.mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));

    await expect(loadPlans('recovery')).resolves.toEqual([]);
  });

  it('degrades to an empty list on a network error', async () => {
    serverApiFetch.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'x'));

    await expect(loadPlans()).resolves.toEqual([]);
  });

  it('does not swallow the control-flow errors of Next', async () => {
    serverApiFetch.mockImplementation(() => notFound());

    await expect(loadPlans('rehab')).rejects.toMatchObject({ digest: expect.stringContaining('404') });
  });
});
