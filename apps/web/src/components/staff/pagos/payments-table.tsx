import { StatusBadge, type StatusTone } from '@/components/move/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PaymentMethod, PurchaseStatus, StaffPaymentDto } from '@/lib/api/types';
import { formatDate, formatTime, formatUYU, SERVICE_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MOBILE_CELL, MOBILE_LABELLED_CELL, MOBILE_ROW, MOBILE_TABLE, MOBILE_TABLE_BODY, MOBILE_TABLE_HEAD } from '@/components/staff/shared/mobile-card';

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  mercadopago: 'Mercado Pago',
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

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
      <Table className={MOBILE_TABLE}>
        <TableHeader className={MOBILE_TABLE_HEAD}>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Ítem</TableHead>
            <TableHead>Servicio</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className={MOBILE_TABLE_BODY}>
          {payments.map((payment) => {
            const badge = STATUS_BADGE[payment.status];
            return (
              <TableRow key={payment.purchaseId} className={cn(MOBILE_ROW, payment.needsAttention && 'bg-warning-muted/40')}>
                <TableCell data-label="Fecha" className={cn('whitespace-nowrap', MOBILE_LABELLED_CELL, 'max-md:order-4')}>
                  {formatDate(payment.createdAt)} <span className="text-muted-foreground">{formatTime(payment.createdAt)}</span>
                </TableCell>
                <TableCell className={cn(MOBILE_CELL, 'max-md:order-1 max-md:col-span-2')}>
                  <div className="font-medium">{payment.client.name}</div>
                  <div className="text-xs text-muted-foreground">{payment.client.email}</div>
                </TableCell>
                <TableCell data-label="Ítem" className={cn(MOBILE_LABELLED_CELL, 'max-md:order-3 max-md:col-span-2')}>
                  <div>{payment.itemName}</div>
                  {payment.note ? <div className="text-xs text-muted-foreground">{payment.note}</div> : null}
                </TableCell>
                <TableCell data-label="Servicio" className={cn(MOBILE_LABELLED_CELL, 'max-md:order-5')}>{SERVICE_LABEL[payment.service]}</TableCell>
                <TableCell data-label="Monto" className={cn('whitespace-nowrap', MOBILE_LABELLED_CELL, 'max-md:order-6')}>{formatUYU(payment.amount)}</TableCell>
                <TableCell data-label="Método" className={cn(MOBILE_LABELLED_CELL, 'max-md:order-7')}>{METHOD_LABEL[payment.method]}</TableCell>
                <TableCell data-label="Estado" className={cn(MOBILE_LABELLED_CELL, 'max-md:order-2 max-md:col-span-2')}>
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
