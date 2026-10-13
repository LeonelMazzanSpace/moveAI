'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { AlertCountsDto } from '@/lib/api/types';

/** Open follow-up alerts, shared by the staff sidebar and the staff mobile menu through one query. */
export function useStaffAlertsTotal(): number {
  const { data: counts } = useQuery({
    queryKey: ['staff', 'alert-counts'],
    queryFn: () => apiFetch<AlertCountsDto>('/staff/alerts/counts'),
    refetchInterval: 60_000,
  });
  return counts?.total ?? 0;
}
