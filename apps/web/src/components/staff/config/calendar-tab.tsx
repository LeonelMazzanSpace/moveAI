'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/move/error-state';
import { BUTTON_DANGER, BUTTON_OUTLINE, BUTTON_PRIMARY, FormField, SELECT_CLASS } from '@/components/staff/form-primitives';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/errors';
import type { CalendarStatusDto } from '@/lib/api/types';
import { businessDateOf, formatDate, formatTime } from '@/lib/format';
import {
  useCalendarOptions,
  useCalendarStatus,
  useConnectCalendar,
  useDisconnectCalendar,
  useSelectCalendar,
  useSyncCalendar,
} from './use-calendar';

const TAB_PATH = '/staff/configuracion?tab=calendario';
const CONNECT_RESULTS = {
  connected: () => toast.success('Google Calendar conectado'),
  error: () => toast.error('No pudimos conectar Google Calendar. Probá de nuevo.'),
} as const;

function isConnectResult(value: string | null): value is keyof typeof CONNECT_RESULTS {
  return value !== null && Object.hasOwn(CONNECT_RESULTS, value);
}

/** Toasts the outcome of the Google consent screen (`?calendar=connected|error`) once and clears the parameter. */
function useConnectResultToast() {
  const router = useRouter();
  const result = useSearchParams().get('calendar');
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current || !isConnectResult(result)) return;
    shown.current = true;
    CONNECT_RESULTS[result]();
    router.replace(TAB_PATH);
  }, [result, router]);
}

function formatDateTime(iso: string): string {
  const date = businessDateOf(iso);
  return date ? `${formatDate(date)} ${formatTime(iso)}` : '—';
}

function lastSync(status: CalendarStatusDto): string {
  const instants = [status.lastPushAt, status.lastPullAt].filter((value): value is string => value !== null);
  if (instants.length === 0) return 'Todavía no sincronizó';
  return formatDateTime(instants.reduce((latest, value) => (new Date(value) > new Date(latest) ? value : latest)));
}

function ConnectButton({ label }: { label: string }) {
  const connect = useConnectCalendar();
  return (
    <button type="button" className={BUTTON_PRIMARY} disabled={connect.isPending} onClick={() => connect.mutate()}>
      {label}
    </button>
  );
}

function NotConfigured() {
  return (
    <p className="max-w-3xl rounded border border-border bg-card p-4 text-sm text-muted-foreground">
      Falta configurar Google en el servidor: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y CALENDAR_TOKEN_KEY.
    </p>
  );
}

function Disconnected() {
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Conectá el Google Calendar de MOVE para que las reservas de Rehab aparezcan ahí y los horarios ocupados en Google no se puedan reservar.
      </p>
      <ConnectButton label="Conectar Google Calendar" />
    </div>
  );
}

function NeedsReconnect() {
  return (
    <div className="max-w-3xl space-y-4">
      <p role="status" className="rounded border border-border bg-warning-muted p-4 text-sm text-warning">
        Perdimos el acceso a Google Calendar. Los horarios ocupados en Google dejaron de bloquear turnos y las reservas nuevas no se
        sincronizan hasta que vuelvas a conectar la cuenta.
      </p>
      <ConnectButton label="Reconectar" />
    </div>
  );
}

function ChooseCalendar({ status }: { status: CalendarStatusDto }) {
  const id = useId();
  const [calendarId, setCalendarId] = useState('');
  const options = useCalendarOptions(true);
  const select = useSelectCalendar();

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Cuenta conectada: <span className="font-medium text-foreground">{status.accountEmail}</span>. Elegí el calendario donde MOVE va a
        crear las reservas de Rehab.
      </p>
      {options.isError ? <ErrorState error={options.error} onRetry={() => void options.refetch()} /> : null}
      {options.isPending ? <Skeleton className="h-16" /> : null}
      {options.data ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            select.mutate(calendarId);
          }}
        >
          <div className="min-w-64 flex-1">
            <FormField id={id} label="Calendario de MOVE">
              <select id={id} className={SELECT_CLASS} value={calendarId} onChange={(event) => setCalendarId(event.target.value)}>
                <option value="">Elegí un calendario</option>
                {options.data.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.primary ? `${option.name} (principal)` : option.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <button type="submit" className={BUTTON_PRIMARY} disabled={calendarId === '' || select.isPending}>
            Guardar
          </button>
        </form>
      ) : null}
    </div>
  );
}

function DisconnectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const disconnect = useDisconnectCalendar();

  function handleOpenChange(next: boolean) {
    if (!next) disconnect.reset();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desconectar Google Calendar</DialogTitle>
          <DialogDescription>
            Los turnos ocupados en Google van a volver a poder reservarse y las reservas nuevas de Rehab dejan de sincronizarse. Los eventos
            que ya se crearon en Google Calendar quedan ahí.
          </DialogDescription>
        </DialogHeader>
        {disconnect.error ? (
          <p role="alert" className="text-sm text-danger">
            {errorMessage(disconnect.error)}
          </p>
        ) : null}
        <DialogFooter>
          <button type="button" className={BUTTON_OUTLINE} onClick={() => handleOpenChange(false)}>
            Volver
          </button>
          <button
            type="button"
            className={BUTTON_DANGER}
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate(undefined, { onSuccess: () => onOpenChange(false) })}
          >
            Sí, desconectar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Connected({ status }: { status: CalendarStatusDto }) {
  const sync = useSyncCalendar();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="max-w-3xl space-y-6">
      <dl className="grid gap-4 rounded border border-border bg-card p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Cuenta</dt>
          <dd className="break-all font-medium">{status.accountEmail}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Calendario</dt>
          <dd className="font-medium">{status.calendarName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Última sincronización</dt>
          <dd className="font-medium">{lastSync(status)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={BUTTON_PRIMARY} disabled={sync.isPending} onClick={() => sync.mutate()}>
          {sync.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>
        <button type="button" className={BUTTON_OUTLINE} onClick={() => setConfirming(true)}>
          Desconectar
        </button>
      </div>
      <DisconnectDialog open={confirming} onOpenChange={setConfirming} />
    </div>
  );
}

function CalendarState({ status }: { status: CalendarStatusDto }) {
  if (!status.configured) return <NotConfigured />;
  if (status.status === 'needs_reconnect') return <NeedsReconnect />;
  if (status.status === 'disconnected') return <Disconnected />;
  if (status.calendarId === null) return <ChooseCalendar status={status} />;
  return <Connected status={status} />;
}

export function CalendarTab() {
  useConnectResultToast();
  const { data, error, isPending, refetch } = useCalendarStatus();

  if (isPending) return <Skeleton className="h-40 max-w-3xl" />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return <CalendarState status={data} />;
}
