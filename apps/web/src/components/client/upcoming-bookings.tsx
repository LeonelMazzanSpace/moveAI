'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/move/empty-state';
import { ErrorState } from '@/components/move/error-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { BookingDto, Service } from '@/lib/api/types';
import { formatDate, formatTime, formatWeekdayShort } from '@/lib/format';

const SERVICE_TITLE: Record<Service, string> = {
  performance: 'Performance',
  rehab: 'Fisioterapia',
  recovery: 'Recovery',
};

const INVALIDATED_KEYS = [['me', 'bookings'], ['me', 'activity'], ['me', 'subscriptions']] as const;

function useCancelBooking(onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => apiFetch<BookingDto>(`/bookings/${bookingId}/cancel`, { method: 'POST' }),
    onSuccess: async () => {
      toast.success('Reserva cancelada');
      onDone();
      await Promise.all(INVALIDATED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      onDone();
    },
  });
}

function BookingRow({ booking, onCancel }: { booking: BookingDto; onCancel: (booking: BookingDto) => void }) {
  return (
    <li className="flex items-center justify-between gap-4 px-7 py-4">
      <div className="flex items-center gap-4">
        <div className="rounded border border-border bg-soft px-3 py-2 text-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{formatWeekdayShort(booking.startsAt)}</p>
          <p className="font-display text-lg font-black leading-none">{formatDate(booking.startsAt).slice(0, 2)}</p>
        </div>
        <div>
          <p className="text-sm font-medium">{`${SERVICE_TITLE[booking.service]} — ${formatTime(booking.startsAt)}`}</p>
          <p className="text-xs text-muted-foreground">{booking.label}</p>
        </div>
      </div>
      {booking.canCancel ? (
        <Button variant="outline" size="sm" onClick={() => onCancel(booking)}>
          Cancelar
        </Button>
      ) : null}
      {!booking.canCancel && booking.source === 'payment' ? (
        <span className="text-xs text-muted-foreground">Cancelación con MOVE</span>
      ) : null}
    </li>
  );
}

function CancelDialog({ booking, onClose }: { booking: BookingDto | null; onClose: () => void }) {
  const cancel = useCancelBooking(onClose);
  return (
    <Dialog open={booking !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {booking ? `¿Cancelar la reserva del ${formatDate(booking.startsAt)} a las ${formatTime(booking.startsAt)}?` : ''}
          </DialogTitle>
          <DialogDescription>El cupo se libera para otros clientes.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={cancel.isPending}>
            Volver
          </Button>
          <Button onClick={() => booking && cancel.mutate(booking.id)} disabled={cancel.isPending}>
            Sí, cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BookingsBody({ onCancel }: { onCancel: (booking: BookingDto) => void }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['me', 'bookings', 'upcoming'],
    queryFn: () => apiFetch<BookingDto[]>('/me/bookings', { query: { scope: 'upcoming' } }),
  });

  if (isPending) return <Skeleton className="m-7 h-24" />;
  if (isError) return <div className="p-4"><ErrorState error={error} onRetry={() => void refetch()} /></div>;
  if (data.length === 0) {
    return (
      <div className="p-4">
        <EmptyState title="No tenés reservas próximas" description="Cuando reserves un turno lo vas a ver acá." />
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {data.map((booking) => (
        <BookingRow key={booking.id} booking={booking} onCancel={onCancel} />
      ))}
    </ul>
  );
}

export function UpcomingBookings() {
  const [pending, setPending] = useState<BookingDto | null>(null);

  return (
    <div className="rounded border border-border bg-card">
      <div className="border-b border-border px-7 py-4">
        <h2 className="text-sm font-semibold">Próximas reservas</h2>
      </div>
      <BookingsBody onCancel={setPending} />
      <CancelDialog booking={pending} onClose={() => setPending(null)} />
    </div>
  );
}
