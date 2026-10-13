import Link from 'next/link';
import { StatusBadge, type StatusTone } from '@/components/move/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import type { CheckinFlag, CheckinResponseDto } from '@/lib/api/types';
import { addDaysWeb, businessTodayWeb, formatDayMonth, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const ACTION_CLASS = 'h-auto px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]';

const FLAG_BADGE: Record<CheckinFlag, { tone: StatusTone; label: string }> = {
  pain: { tone: 'warning', label: 'Molestia reportada' },
  goals: { tone: 'warning', label: 'Cambio de objetivos' },
  ok: { tone: 'success', label: 'Todo bien' },
};

function respondedLabel(respondedAt: string, today: string): string {
  const day = businessTodayWeb(new Date(respondedAt));
  const time = formatTime(respondedAt);
  if (day === today) return `hoy ${time}`;
  if (day === addDaysWeb(today, -1)) return `ayer ${time}`;
  return `${formatDayMonth(respondedAt)} ${time}`;
}

function summaryFor(response: CheckinResponseDto): string {
  if (response.flag === 'pain') return `“${response.painDetail ?? 'Sin detalle'}”`;
  if (response.flag === 'goals') return `“${response.goalsDetail ?? 'Sin detalle'}”`;
  return 'Sin molestias · objetivos sin cambios.';
}

interface ResponseCardProps {
  response: CheckinResponseDto;
  today: string;
  onContact: (response: CheckinResponseDto) => void;
  onRefer: (response: CheckinResponseDto) => void;
  onHandle: (response: CheckinResponseDto) => void;
  busy?: boolean;
  referred?: boolean;
}

export function ResponseCard({ response, today, onContact, onRefer, onHandle, busy = false, referred = false }: ResponseCardProps) {
  const badge = FLAG_BADGE[response.flag];
  const alertOpen = response.alertId !== null && response.alertStatus === 'open';
  const plan = response.planName ? `plan ${response.planName}` : 'sin plan vigente';

  return (
    <div className={cn('rounded border bg-card p-6', response.flag === 'ok' ? 'border-border' : 'border-warning/30')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="font-medium">{response.client.name}</p>
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
            {response.flag !== 'ok' && response.alertStatus === 'handled' ? <StatusBadge tone="neutral">Gestionada</StatusBadge> : null}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{summaryFor(response)}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {`Respondió ${respondedLabel(response.respondedAt, today)} · entrena ${response.frequencyPerWeek.toFixed(1)} /sem · ${plan}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {response.flag !== 'ok' && alertOpen ? (
            <Button className={ACTION_CLASS} onClick={() => onContact(response)}>
              Contactar
            </Button>
          ) : null}
          {response.flag === 'pain' ? (
            <Button variant="outline" className={ACTION_CLASS} disabled={busy || referred} onClick={() => onRefer(response)}>
              {referred ? 'Derivado a Rehab' : 'Derivar a Rehab'}
            </Button>
          ) : null}
          {response.flag === 'goals' && alertOpen ? (
            <Button variant="outline" className={ACTION_CLASS} disabled={busy} onClick={() => onHandle(response)}>
              Marcar gestionado
            </Button>
          ) : null}
          {response.flag === 'ok' ? (
            <Link href={`/staff/clientes/${response.client.id}`} className={cn(buttonVariants({ variant: 'outline' }), ACTION_CLASS)}>
              Ver perfil
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
