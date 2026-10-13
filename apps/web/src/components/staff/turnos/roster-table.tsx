import { StatusBadge, type StatusTone } from '@/components/move/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AttendanceStatus, RosterItemDto } from '@/lib/api/types';
import { formatDayMonth, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AttendanceButtons } from './attendance-buttons';

interface RosterPagination {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

interface RosterTableProps {
  rows: RosterItemDto[];
  canMark: boolean;
  markHint?: string;
  onMark: (bookingId: string, status: AttendanceStatus) => void;
  onCancel?: (bookingId: string) => void;
  pagination?: RosterPagination;
}

interface RowState {
  label: string;
  tone: StatusTone;
}

const ATTENDANCE_STATE: Record<AttendanceStatus, RowState> = {
  present: { label: 'Presente', tone: 'success' },
  absent: { label: 'Ausente', tone: 'danger' },
  no_show: { label: 'No show', tone: 'danger' },
};

function rowState(row: RosterItemDto): RowState {
  if (row.status === 'cancelled') return { label: 'Cancelada', tone: 'neutral' };
  if (row.status === 'expired') return { label: 'Expirada', tone: 'neutral' };
  if (row.status === 'pending_payment') return { label: 'Pago pendiente', tone: 'warning' };
  return row.attendance ? ATTENDANCE_STATE[row.attendance] : { label: 'Pendiente', tone: 'neutral' };
}

const isInactive = (row: RosterItemDto): boolean => row.status === 'cancelled' || row.status === 'expired';

function inactiveLabel(row: RosterItemDto): string | null {
  if (!row.cancelledAt) return null;
  const verb = row.status === 'expired' ? 'Expiró' : 'Canceló';
  return `${verb} ${formatDayMonth(row.cancelledAt)} — ${formatTime(row.cancelledAt)}`;
}

function RowActions({ row, canMark, markHint, onMark, onCancel }: Pick<RosterTableProps, 'canMark' | 'markHint' | 'onMark' | 'onCancel'> & { row: RosterItemDto }) {
  if (isInactive(row)) {
    return <span className="text-xs text-muted-foreground">{inactiveLabel(row)}</span>;
  }
  return (
    <div className="flex items-center justify-end gap-2">
      {row.status === 'confirmed' ? (
        <AttendanceButtons value={row.attendance} canMark={canMark} hint={markHint} onMark={(status) => onMark(row.bookingId, status)} />
      ) : null}
      {onCancel ? (
        <button
          type="button"
          aria-label={`Cancelar reserva de ${row.client.name}`}
          onClick={() => onCancel(row.bookingId)}
          className="rounded px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-danger"
        >
          Cancelar
        </button>
      ) : null}
    </div>
  );
}

function Pagination({ total, page, pageSize, onPageChange, shown }: RosterPagination & { shown: number }) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const buttonClass = 'rounded border border-border px-3 py-1.5 disabled:opacity-50';
  return (
    <div className="flex items-center justify-between border-t border-border px-6 py-3 text-xs text-muted-foreground">
      <span>
        Mostrando {shown} de {total} registros del turno
      </span>
      <div className="flex gap-1">
        <button type="button" aria-label="Página anterior" className={buttonClass} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          ←
        </button>
        <button type="button" aria-label="Página siguiente" className={buttonClass} disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
          →
        </button>
      </div>
    </div>
  );
}

export function RosterTable({ rows, canMark, markHint, onMark, onCancel, pagination }: RosterTableProps) {
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <TableHead className="px-6">Alumno</TableHead>
            <TableHead className="px-6">Plan</TableHead>
            <TableHead className="px-6">Última asistencia</TableHead>
            <TableHead className="px-6">Estado</TableHead>
            <TableHead className="px-6 text-right">Registrar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const state = rowState(row);
            return (
              <TableRow key={row.bookingId} className={cn(isInactive(row) && 'opacity-50')}>
                <TableCell className={cn('px-6 py-3.5 font-medium', isInactive(row) && 'line-through')}>{row.client.name}</TableCell>
                <TableCell className="px-6 py-3.5 text-muted-foreground">{row.planName ?? '—'}</TableCell>
                <TableCell className="px-6 py-3.5 text-muted-foreground">
                  {row.lastAttendanceOn ? formatDayMonth(row.lastAttendanceOn) : '—'}
                </TableCell>
                <TableCell className="px-6 py-3.5">
                  <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                </TableCell>
                <TableCell className="px-6 py-3.5 text-right">
                  <RowActions row={row} canMark={canMark} markHint={markHint} onMark={onMark} onCancel={onCancel} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {pagination ? <Pagination {...pagination} shown={rows.length} /> : null}
    </>
  );
}
