import { unstable_rethrow } from 'next/navigation';
import { serverApiFetch } from '@/lib/api/server';
import type { PlanDto, Service } from '@/lib/api/types';

export async function loadPlans(service?: Service): Promise<PlanDto[]> {
  try {
    return await serverApiFetch<PlanDto[]>('/catalog/plans', { query: { service } });
  } catch (error) {
    unstable_rethrow(error);
    return [];
  }
}
