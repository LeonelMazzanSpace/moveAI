import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { apiFetch } from '@/lib/api/client';
import type { ClientKpisDto, SettingsDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'warning' | 'danger';

interface KpiProps {
  label: string;
  value: number;
  tone?: Tone;
  detail: ReactNode;
  detailTone?: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

function Kpi({ label, value, tone, detail, detailTone }: KpiProps) {
  return (
    <div role="group" aria-label={label} className="rounded border border-border bg-card p-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className={cn('mt-2 font-display text-3xl font-black', tone && TONE_CLASSES[tone])}>{value}</p>
      <p className={cn('mt-1 text-xs', detailTone ? TONE_CLASSES[detailTone] : 'text-muted-foreground')}>{detail}</p>
    </div>
  );
}

const SETTINGS_KEY = ['staff', 'settings'] as const;

function useThresholds() {
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: () => apiFetch<SettingsDto>('/staff/settings') });
  return { expiringSoonDays: settings.data?.expiringSoonDays, noAttendanceDays: settings.data?.noAttendanceDays };
}

const dayCount = (days: number) => `${days} ${days === 1 ? 'día' : 'días'}`;

function expiringDetail(days: number | undefined): string {
  if (days === undefined) return 'próximos días';
  return days === 1 ? 'próximo día' : `próximos ${days} días`;
}

function inactiveDetail(days: number | undefined): string {
  return days === undefined ? 'sin asistir' : `+${dayCount(days)} sin asistir`;
}

export function ClientKpis({ kpis }: { kpis: ClientKpisDto }) {
  const { expiringSoonDays, noAttendanceDays } = useThresholds();
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <Kpi label="Clientes activos" value={kpis.active} detail={`+${kpis.activeDeltaMonth} este mes`} detailTone="success" />
      <Kpi label="Planes por vencer" value={kpis.expiringSoon} tone="warning" detail={expiringDetail(expiringSoonDays)} />
      <Kpi label="Inactivos" value={kpis.inactive} tone="danger" detail={inactiveDetail(noAttendanceDays)} />
      <Kpi
        label="Asistencias hoy"
        value={kpis.attendancesToday}
        detail={`en ${kpis.slotsToday} ${kpis.slotsToday === 1 ? 'turno' : 'turnos'}`}
      />
    </div>
  );
}
