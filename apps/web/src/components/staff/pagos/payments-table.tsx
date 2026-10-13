import { StatusBadge, type StatusTone } from '@/components/move/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PaymentMethod, PurchaseStatus, StaffPaymentDto } from '@/lib/api/types';
import { formatDate, formatTime, formatUYU, SERVICE_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';

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
      <Table>
        <TableHeader>
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
        <TableBody>
          {payments.map((payment) => {
            const badge = STATUS_BADGE[payment.status];
            return (
              <TableRow key={payment.purchaseId} className={cn(payment.needsAttention && 'bg-warning-muted/40')}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(payment.createdAt)} <span className="text-muted-foreground">{formatTime(payment.createdAt)}</span>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{payment.client.name}</div>
                  <div className="text-xs text-muted-foreground">{payment.client.email}</div>
                </TableCell>
                <TableCell>
                  <div>{payment.itemName}</div>
                  {payment.note ? <div className="text-xs text-muted-foreground">{payment.note}</div> : null}
                </TableCell>
                <TableCell>{SERVICE_LABEL[payment.service]}</TableCell>
                <TableCell className="whitespace-nowrap">{formatUYU(payment.amount)}</TableCell>
                <TableCell>{METHOD_LABEL[payment.method]}</TableCell>
                <TableCell>
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
