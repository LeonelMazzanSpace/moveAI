'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontalIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import type { RosterItemDto, StaffTimeSlotDto } from '@/lib/api/types';
import { formatTime } from '@/lib/format';

const capacitySchema = z.object({
  capacity: z
    .number({ error: 'Ingresá un número.' })
    .int('Ingresá un número entero.')
    .min(1, 'El cupo mínimo es 1.')
    .max(100, 'El cupo máximo es 100.'),
});

type CapacityForm = z.infer<typeof capacitySchema>;

function useRefreshSlots() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['staff', 'time-slots'] }),
      queryClient.invalidateQueries({ queryKey: ['staff', 'roster'] }),
    ]);
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pending: boolean;
  error: unknown;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCapacityDialog({ slot, open, onOpenChange }: { slot: StaffTimeSlotDto; open: boolean; onOpenChange: (open: boolean) => void }) {
  const refresh = useRefreshSlots();
  const form = useForm<CapacityForm>({
    resolver: zodResolver(capacitySchema),
    defaultValues: { capacity: slot.capacity },
  });
  const mutation = useMutation({
    mutationFn: (values: CapacityForm) =>
      apiFetch<StaffTimeSlotDto>(`/staff/time-slots/${slot.id}`, { method: 'PATCH', body: { capacity: values.capacity } }),
    onSuccess: async () => {
      await refresh();
      toast.success('Cupo actualizado');
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Editar cupo</DialogTitle>
            <DialogDescription>Turno de las {formatTime(slot.startsAt)}. Hoy hay {slot.booked} reservas activas.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="slot-capacity">Cupo</Label>
            <Input id="slot-capacity" type="number" inputMode="numeric" {...form.register('capacity', { valueAsNumber: true })} />
            {form.formState.errors.capacity ? (
              <p role="alert" className="text-sm text-danger">
                {form.formState.errors.capacity.message}
              </p>
            ) : null}
            {mutation.error ? (
              <p role="alert" className="text-sm text-danger">
                {errorMessage(mutation.error)}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Volver
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelSlotDialog({ slot, open, onOpenChange }: { slot: StaffTimeSlotDto; open: boolean; onOpenChange: (open: boolean) => void }) {
  const refresh = useRefreshSlots();
  const mutation = useMutation({
    mutationFn: () => apiFetch<StaffTimeSlotDto>(`/staff/time-slots/${slot.id}/cancel`, { method: 'POST' }),
    onSuccess: async () => {
      await refresh();
      toast.success('Turno cancelado');
      onOpenChange(false);
    },
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cancelar turno"
      description={`Vas a cancelar el turno de las ${formatTime(slot.startsAt)}. Solo se puede si no tiene reservas activas.`}
      confirmLabel="Cancelar turno"
      pending={mutation.isPending}
      error={mutation.error}
      onConfirm={() => mutation.mutate()}
    />
  );
}

export function SlotActions({ slot }: { slot: StaffTimeSlotDto }) {
  const [dialog, setDialog] = useState<'capacity' | 'cancel' | null>(null);
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" aria-label="Acciones del turno" />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setDialog('capacity')}>Editar cupo</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={slot.cancelledAt !== null} onClick={() => setDialog('cancel')}>
            Cancelar turno
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog === 'capacity' ? <EditCapacityDialog slot={slot} open onOpenChange={close} /> : null}
      {dialog === 'cancel' ? <CancelSlotDialog slot={slot} open onOpenChange={close} /> : null}
    </>
  );
}

function CancelBookingConfirm({ booking, onClose }: { booking: RosterItemDto; onClose: () => void }) {
  const refresh = useRefreshSlots();
  const mutation = useMutation({
    mutationFn: () => apiFetch<RosterItemDto>(`/staff/bookings/${booking.bookingId}/cancel`, { method: 'POST' }),
    onSuccess: async () => {
      await refresh();
      toast.success('Reserva cancelada');
      onClose();
    },
  });

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Cancelar reserva"
      description={`Vas a cancelar la reserva de ${booking.client.name}. Si es de un paquete Recovery, la sesión se devuelve. No hay reembolso automático.`}
      confirmLabel="Cancelar reserva"
      pending={mutation.isPending}
      error={mutation.error}
      onConfirm={() => mutation.mutate()}
    />
  );
}

export function CancelBookingDialog({ booking, onClose }: { booking: RosterItemDto | null; onClose: () => void }) {
  if (!booking) return null;
  return <CancelBookingConfirm key={booking.bookingId} booking={booking} onClose={onClose} />;
}
