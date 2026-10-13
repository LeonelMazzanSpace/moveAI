import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClientRowDto, PaymentStatusSummary } from '@/lib/api/types';
import { formatDate, formatDayMonth } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ClientStatusBadge } from './client-status-badge';

const CELL = 'px-4 py-3.5';
const MUTED_CELL = cn(CELL, 'text-muted-foreground');
const EMPTY = '—';

const PAYMENT: Record<PaymentStatusSummary, { label: string; className: string }> = {
  up_to_date: { label: 'Al día', className: 'text-success' },
  overdue: { label: 'Vencido', className: 'text-danger' },
  none: { label: EMPTY, className: 'text-muted-foreground' },
};

function expiryClass(row: ClientRowDto): string {
  if (row.status === 'expiring') return 'text-warning';
  if (row.status === 'expired') return 'text-danger';
  return 'text-muted-foreground';
}

function ServiceUse({ row }: { row: ClientRowDto }) {
  if (row.rehabCount === 0 && row.recoveryCount === 0) return <>{EMPTY}</>;
  return (
    <span className="flex gap-3">
      {row.rehabCount > 0 ? <span>{`Rehab ×${row.rehabCount}`}</span> : null}
      {row.recoveryCount > 0 ? <span>{`Recovery ×${row.recoveryCount}`}</span> : null}
    </span>
  );
}

function ClientRow({ row }: { row: ClientRowDto }) {
  const payment = PAYMENT[row.paymentStatus];
  return (
    <TableRow className="relative hover:bg-soft">
      <TableCell className={cn(CELL, 'font-medium')}>
        <Link
          href={`/staff/clientes/${row.id}`}
          className="block after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {row.name}
        </Link>
        <span className="block text-xs font-normal text-muted-foreground">{row.email}</span>
      </TableCell>
      <TableCell className={CELL}>
        <ClientStatusBadge status={row.status} pauseReason={row.pauseReason} />
      </TableCell>
      <TableCell className={MUTED_CELL}>{row.planName ?? EMPTY}</TableCell>
      <TableCell className={cn(CELL, expiryClass(row))}>{row.endsOn ? formatDate(row.endsOn) : EMPTY}</TableCell>
      <TableCell className={cn(CELL, payment.className)}>{payment.label}</TableCell>
      <TableCell className={MUTED_CELL}>{row.lastAttendanceOn ? formatDayMonth(row.lastAttendanceOn) : EMPTY}</TableCell>
      <TableCell className={MUTED_CELL}>{row.frequencyPerWeek > 0 ? `${row.frequencyPerWeek.toFixed(1)} /sem` : EMPTY}</TableCell>
      <TableCell className={MUTED_CELL}>
        <ServiceUse row={row} />
      </TableCell>
    </TableRow>
  );
}

export function ClientsTable({ rows }: { rows: ClientRowDto[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:bg-transparent">
          <TableHead className="px-4">Cliente</TableHead>
          <TableHead className="px-4">Estado</TableHead>
          <TableHead className="px-4">Plan</TableHead>
          <TableHead className="px-4">Vencimiento</TableHead>
          <TableHead className="px-4">Pagos</TableHead>
          <TableHead className="px-4">Últ. asistencia</TableHead>
          <TableHead className="px-4">Frecuencia</TableHead>
          <TableHead className="px-4">Rehab / Recovery</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <ClientRow key={row.id} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}
