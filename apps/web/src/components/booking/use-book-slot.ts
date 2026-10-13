'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api/client';
import { ApiError, errorMessage } from '@/lib/api/errors';
import type { BookingDto } from '@/lib/api/types';

function hasCode(error: unknown, code: ApiError['code']): boolean {
  return error instanceof ApiError && error.code === code;
}

export function useBookSlot() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const [planRequired, setPlanRequired] = useState(false);

  const mutation = useMutation({
    mutationFn: (timeSlotId: string) =>
      apiFetch<BookingDto>('/bookings', { method: 'POST', body: { timeSlotId } }),
    onMutate: () => setPlanRequired(false),
    onSuccess: () => toast.success('Reserva confirmada'),
    onError: (error) => {
      if (hasCode(error, 'PLAN_REQUIRED')) return setPlanRequired(true);
      if (hasCode(error, 'UNAUTHENTICATED')) return router.push(`/ingresar?next=${encodeURIComponent(pathname)}`);
      toast.error(errorMessage(error));
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['time-slots'] }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
        queryClient.invalidateQueries({ queryKey: ['me', 'bookings'] }),
      ]),
  });

  return {
    book: mutation.mutate,
    planRequired,
    pendingSlotId: mutation.isPending ? mutation.variables : null,
  };
}
