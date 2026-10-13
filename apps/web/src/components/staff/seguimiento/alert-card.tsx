import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatusBadge, type StatusTone } from '@/components/move/status-badge';
import { moveButtonSize } from '@/components/move/button-styles';
import { Button, buttonVariants } from '@/components/ui/button';
import type { AlertDto, AlertType } from '@/lib/api/types';
import { formatDate, formatDayMonth } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ALERT_LABEL, expiringLabel, PAUSE_LABEL } from './alert-labels';

const ACTION_CLASS = moveButtonSize();
const REASON_TYPES: readonly AlertType[] = ['expiring', 'expired', 'no_attendance', 'prolonged_inactivity', 'frequency_drop'];

interface Badge {
  tone: StatusTone;
  label: string;
}

function badgeFor(alert: AlertDto, today: string): Badge {
  switch (alert.type) {
    case 'expiring':
      return { tone: 'warning', label: expiringLabel(alert, today) };
    case 'expired':
      return { tone: 'danger', label: 'Vencido sin renovación' };
    case 'recontact':
      return { tone: 'neutral', label: alert.pause?.recontactOn ? `Re-contactar el ${formatDayMonth(alert.pause.recontactOn)}` : ALERT_LABEL.recontact };
    case 'checkin_pain':
    case 'checkin_goals':
      return { tone: 'warning', label: ALERT_LABEL[alert.type] };
    default:
      return { tone: 'neutral', label: ALERT_LABEL[alert.type] };
  }
}

const perWeek = (value: number): string => `${value.toFixed(1)} /sem`;

function frequencyPart(alert: AlertDto): string | null {
  const usual = alert.usualFrequencyPerWeek;
  switch (alert.type) {
    case 'no_attendance':
    case 'prolonged_inactivity':
      return usual === null ? null : `frecuencia habitual ${perWeek(usual)}`;
    case 'frequency_drop':
      return usual === null
        ? `frecuencia ${perWeek(alert.frequencyPerWeek)}`
        : `frecuencia ${perWeek(alert.frequencyPerWeek)} (habitual ${perWeek(usual)})`;
    default:
      return `frecuencia ${perWeek(alert.frequencyPerWeek)}`;
  }
}

function contactsPart(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? '1 contacto previo' : `${count} contactos previos`;
}

function pauseMeta(alert: AlertDto): string | null {
  if (!alert.pause) return null;
  const registered = `${PAUSE_LABEL[alert.pause.reason]} registrada el ${formatDayMonth(alert.pause.since)}`;
  if (!alert.pause.recontactOn) return registered;
  return `${registered} · pidió ser contactada nuevamente el ${formatDate(alert.pause.recontactOn)}`;
}

function metaLine(alert: AlertDto): string {
  if (alert.type === 'recontact') {
    const pause = pauseMeta(alert);
    if (pause) return pause;
  }
  const parts = [
    alert.planName,
    alert.endsOn ? `${alert.type === 'expired' ? 'venció' : 'vence'} ${formatDate(alert.endsOn)}` : null,
    alert.lastAttendanceOn ? `última asistencia ${formatDayMonth(alert.lastAttendanceOn)}` : null,
    frequencyPart(alert),
    contactsPart(alert.contactsCount),
  ];
  return parts.filter(Boolean).join(' · ');
}

function quoteFor(alert: AlertDto): string | null {
  const detail = alert.type === 'checkin_pain' ? alert.checkin?.painDetail : alert.type === 'checkin_goals' ? alert.checkin?.goalsDetail : null;
  return detail ? `“${detail}”` : null;
}

interface AlertCardProps {
  alert: AlertDto;
  today: string;
  onContact: (alert: AlertDto) => void;
  onHandle: (alert: AlertDto) => void;
  onReason: (alert: AlertDto) => void;
  busy?: boolean;
  children?: ReactNode;
}

export function AlertCard({ alert, today, onContact, onHandle, onReason, busy = false, children }: AlertCardProps) {
  const badge = badgeFor(alert, today);
  const quote = quoteFor(alert);
  const isOpen = alert.status === 'open';

  return (
    <div className="rounded border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-soft text-xs font-bold">{alert.client.initials}</div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="font-medium">{alert.client.name}</p>
              <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
              {isOpen ? null : <StatusBadge tone="success">Gestionada</StatusBadge>}
            </div>
            {quote ? <p className="mt-2 text-sm text-muted-foreground">{quote}</p> : null}
            <p className="mt-1.5 text-xs text-muted-foreground">{metaLine(alert)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOpen ? (
            <>
              <Button className={ACTION_CLASS} onClick={() => onContact(alert)}>
                Contactar
              </Button>
              <Button variant="outline" className={ACTION_CLASS} disabled={busy} onClick={() => onHandle(alert)}>
                Marcar gestionado
              </Button>
              {REASON_TYPES.includes(alert.type) ? (
                <Button variant="outline" className={ACTION_CLASS} onClick={() => onReason(alert)}>
                  Registrar motivo
                </Button>
              ) : null}
            </>
          ) : null}
          <Link href={`/staff/clientes/${alert.client.id}`} className={cn(buttonVariants({ variant: 'outline' }), ACTION_CLASS)}>
            Ver historial
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
