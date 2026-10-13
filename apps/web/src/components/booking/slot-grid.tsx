import { moveButtonSize } from '@/components/move/button-styles';
import { Button } from '@/components/ui/button';
import type { TimeSlotDto } from '@/lib/api/types';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface SlotGridProps {
  slots: TimeSlotDto[];
  onBook: (slot: TimeSlotDto) => void;
  pendingSlotId?: string | null;
}

const BADGE_CLASSES =
  'rounded border border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground';

function SlotAction({ slot, onBook, pending }: { slot: TimeSlotDto; onBook: (slot: TimeSlotDto) => void; pending: boolean }) {
  if (slot.bookedByMe) return <span className={BADGE_CLASSES}>Reservado</span>;
  if (slot.isFull) return <span className={BADGE_CLASSES}>Completo</span>;
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => onBook(slot)}
      className={moveButtonSize()}
    >
      Reservar
    </Button>
  );
}

export function SlotGrid({ slots, onBook, pendingSlotId = null }: SlotGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {slots.map((slot) => (
        <div
          key={slot.id}
          className={cn(
            'flex items-center justify-between rounded border border-border px-5 py-4',
            slot.isFull && !slot.bookedByMe ? 'bg-soft opacity-60' : 'bg-card',
          )}
        >
          <div>
            <p className="font-display text-lg font-extrabold">{formatTime(slot.startsAt)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{`${slot.booked} / ${slot.capacity} cupos`}</p>
          </div>
          <SlotAction slot={slot} onBook={onBook} pending={pendingSlotId !== null} />
        </div>
      ))}
    </div>
  );
}
