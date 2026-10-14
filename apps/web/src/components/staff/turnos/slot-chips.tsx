import { StatusBadge } from '@/components/move/status-badge';
import { buttonVariants } from '@/components/ui/button';
import type { StaffTimeSlotDto } from '@/lib/api/types';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface SlotChipsProps {
  slots: StaffTimeSlotDto[];
  selectedId: string | null;
  onSelect: (slotId: string) => void;
}

function CalendarBadge({ id, slot }: { id: string; slot: StaffTimeSlotDto }) {
  if (slot.calendarBlocked && slot.calendarConflict) {
    return (
      <span id={id}>
        <StatusBadge tone="danger">Conflicto con Google Calendar</StatusBadge>
      </span>
    );
  }
  if (!slot.calendarBlocked) return null;
  return (
    <span id={id}>
      <StatusBadge tone="warning">Ocupado en Google Calendar</StatusBadge>
    </span>
  );
}

export function SlotChips({ slots, selectedId, onSelect }: SlotChipsProps) {
  return (
    <div role="group" aria-label="Turnos del día" className="flex flex-wrap items-start gap-2">
      {slots.map((slot) => {
        const selected = slot.id === selectedId;
        const badgeId = `slot-${slot.id}-calendar`;
        const hasBadge = slot.calendarBlocked;
        return (
          <div key={slot.id} className="flex flex-col items-start gap-1">
            <button
              type="button"
              aria-pressed={selected}
              aria-describedby={hasBadge ? badgeId : undefined}
              onClick={() => onSelect(slot.id)}
              className={cn(buttonVariants({ variant: selected ? 'default' : 'outline', size: 'lg' }), slot.cancelledAt && 'line-through opacity-60')}
            >
              {formatTime(slot.startsAt)}
            </button>
            <CalendarBadge id={badgeId} slot={slot} />
          </div>
        );
      })}
    </div>
  );
}
