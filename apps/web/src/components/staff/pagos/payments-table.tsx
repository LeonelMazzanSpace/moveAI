import { StatusBadge, type StatusTone } from '@/components/move/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PaymentMethod, PaymentOrigin, PurchaseStatus, StaffPaymentDto } from '@/lib/api/types';
import { formatDate, formatTime, formatUYU, SERVICE_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MOBILE_CELL, MOBILE_LABELLED_CELL, MOBILE_ROW, MOBILE_TABLE, MOBILE_TABLE_BODY, MOBILE_TABLE_HEAD } from '@/components/staff/shared/mobile-card';

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  mercadopago: 'Mercado Pago',
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

/** Valor de `origen` en la URL de cada origen de pago. */
export const ORIGIN_PARAM: Record<PaymentOrigin, string> = { one_time: 'unico', auto_debit: 'debito' };
const ORIGINS = Object.keys(ORIGIN_PARAM) as PaymentOrigin[];

/** Origen del filtro `?origen=`; cualquier valor que no sea `debito` o `unico` se ignora. Lo usa también la página (servidor). */
export function originFromParam(raw: string | undefined): PaymentOrigin | null {
  return ORIGINS.find((origin) => ORIGIN_PARAM[origin] === raw) ?? null;
}

const STATUS_BADGE: Record<PurchaseStatus, { label: string; tone: StatusTone }> = {
  approved: { label: 'Aprobado', tone: 'success' },
  pending: { label: 'Pendiente', tone: 'warning' },
  rejected: { label: 'Rechazado', tone: 'danger' },
  cancelled: { label: 'Cancelado', tone: 'danger' },
  expired: { label: 'Expirado', tone: 'danger' },
};

export function PaymentsTable({ payments }: { payments: StaffPaymentDto[] }) {
  return (
    <div className="rounded border border-border">
      <Table role="table" className={MOBILE_TABLE}>
        <TableHeader role="rowgroup" className={MOBILE_TABLE_HEAD}>
          <TableRow role="row">
            <TableHead role="columnheader">Fecha</TableHead>
            <TableHead role="columnheader">Cliente</TableHead>
            <TableHead role="columnheader">Ítem</TableHead>
            <TableHead role="columnheader">Servicio</TableHead>
            <TableHead role="columnheader">Monto</TableHead>
            <TableHead role="columnheader">Método</TableHead>
            <TableHead role="columnheader">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody role="rowgroup" className={MOBILE_TABLE_BODY}>
          {payments.map((payment) => {
            const badge = STATUS_BADGE[payment.status];
            return (
              <TableRow role="row" key={payment.purchaseId} className={cn(MOBILE_ROW, payment.needsAttention && 'bg-warning-muted/40')}>
                <TableCell role="cell" data-label="Fecha" className={cn('whitespace-nowrap', MOBILE_LABELLED_CELL, 'max-md:col-span-2')}>
                  {formatDate(payment.createdAt)} <span className="text-muted-foreground">{formatTime(payment.createdAt)}</span>
                </TableCell>
                <TableCell role="cell" className={cn(MOBILE_CELL, 'max-md:col-span-2')}>
                  <span className="sr-only">Cliente: </span>
                  <div className="font-medium">{payment.client.name}</div>
                  <div className="text-xs text-muted-foreground">{payment.client.email}</div>
                </TableCell>
                <TableCell role="cell" data-label="Ítem" className={cn(MOBILE_LABELLED_CELL, 'max-md:col-span-2')}>
                  <div>{payment.itemName}</div>
                  {payment.note ? <div className="text-xs text-muted-foreground">{payment.note}</div> : null}
                </TableCell>
                <TableCell role="cell" data-label="Servicio" className={MOBILE_LABELLED_CELL}>{SERVICE_LABEL[payment.service]}</TableCell>
                <TableCell role="cell" data-label="Monto" className={cn('whitespace-nowrap', MOBILE_LABELLED_CELL)}>{formatUYU(payment.amount)}</TableCell>
                <TableCell role="cell" data-label="Método" className={MOBILE_LABELLED_CELL}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{METHOD_LABEL[payment.method]}</span>
                    {payment.origin === 'auto_debit' ? <StatusBadge tone="neutral">Débito automático</StatusBadge> : null}
                  </div>
                </TableCell>
                <TableCell role="cell" data-label="Estado" className={MOBILE_LABELLED_CELL}>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                    {payment.needsAttention ? <StatusBadge tone="warning">Revisar</StatusBadge> : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
