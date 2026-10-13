import { StatusBadge, type StatusTone } from '@/components/move/status-badge';
import type { ClientStatus, InactivityReasonCode } from '@/lib/api/types';
import { INACTIVITY_REASON_LABEL } from '../shared/inactivity-reasons';

interface ClientStatusBadgeProps {
  status: ClientStatus;
  pauseReason: InactivityReasonCode | null;
}

const STATUS: Record<Exclude<ClientStatus, 'paused'>, { label: string; tone: StatusTone }> = {
  active: { label: 'Activo', tone: 'success' },
  expiring: { label: 'Por vencer', tone: 'warning' },
  inactive: { label: 'Inactivo', tone: 'danger' },
  expired: { label: 'Vencido', tone: 'danger' },
  no_plan: { label: 'Sin plan', tone: 'neutral' },
};

function pauseLabel(pauseReason: InactivityReasonCode | null): string {
  return pauseReason ? `Pausa — ${INACTIVITY_REASON_LABEL[pauseReason]}` : 'Pausa';
}

export function ClientStatusBadge({ status, pauseReason }: ClientStatusBadgeProps) {
  if (status === 'paused') return <StatusBadge tone="neutral">{pauseLabel(pauseReason)}</StatusBadge>;
  const { label, tone } = STATUS[status];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
