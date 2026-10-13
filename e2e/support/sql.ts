// SQL directo contra la base de E2E, solo para lo que la API no permite crear (como scripts/manual/demo-data.mjs):
// planes vencidos y turnos de hoy ya empezados para marcar asistencia.
import { spawnSync } from 'node:child_process';
import { E2E_DB_CONTAINER, E2E_DB_NAME } from '../../scripts/e2e/env.mjs';

const UUID = /^[0-9a-f-]{36}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function sql(statement: string): string {
  const result = spawnSync(
    'docker',
    ['exec', '-i', E2E_DB_CONTAINER, 'psql', '-U', process.env.DB_USER ?? 'move', '-d', E2E_DB_NAME, '-v', 'ON_ERROR_STOP=1', '-At', '-f', '-'],
    { input: statement, encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(`SQL de E2E falló: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function assertMatches(value: string, pattern: RegExp): string {
  if (!pattern.test(value)) throw new Error(`Valor inesperado para SQL: ${value}`);
  return value;
}

// Deja el plan Performance del cliente vencido: un mes que terminó el día `endsOn`.
export function expireSubscription(userId: string, endsOn: string): void {
  const id = assertMatches(userId, UUID);
  const end = assertMatches(endsOn, DATE);
  sql(`UPDATE subscriptions SET starts_on = '${end}'::date - 30, ends_on = '${end}'::date
       WHERE user_id = '${id}' AND service = 'performance' AND deleted_at IS NULL;`);
}

// Corre un turno (y sus reservas) `days` días hacia atrás.
export function moveSlotBack(slotId: string, days: number): void {
  const id = assertMatches(slotId, UUID);
  sql(`UPDATE time_slots SET starts_at = starts_at - interval '${Math.trunc(days)} days',
       ends_at = ends_at - interval '${Math.trunc(days)} days' WHERE id = '${id}';`);
}
