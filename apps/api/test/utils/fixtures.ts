import type { DataSource } from 'typeorm';
import type { Service } from '../../src/modules/catalog/entities/plan.entity.js';

// Plain SQL fixtures for e2e tests. The plan helpers need `seedCatalogAndSchedule` to have run.

const DURATION_MINUTES: Record<Service, number> = { performance: 60, rehab: 60, recovery: 45 };

export async function createSlot(
  ds: DataSource,
  input: { service: Service; startsAt: Date; capacity: number; professionalId?: string },
): Promise<string> {
  const endsAt = new Date(input.startsAt.getTime() + DURATION_MINUTES[input.service] * 60_000);
  const [row] = await ds.query(
    `INSERT INTO time_slots (service, starts_at, ends_at, capacity, professional_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.service, input.startsAt, endsAt, input.capacity, input.professionalId ?? null],
  );
  return row.id as string;
}

export async function createProfessional(ds: DataSource, name = 'Fisio Test'): Promise<string> {
  const [row] = await ds.query(`INSERT INTO professionals (name) VALUES ($1) RETURNING id`, [name]);
  return row.id as string;
}

export async function planIdBySlug(ds: DataSource, slug: string): Promise<string> {
  const [row] = await ds.query(`SELECT id FROM plans WHERE slug = $1 AND deleted_at IS NULL`, [slug]);
  if (!row) throw new Error(`plan ${slug} not seeded`);
  return row.id as string;
}

export async function givePerformancePlan(
  ds: DataSource,
  userId: string,
  input: { startsOn: string; endsOn: string },
): Promise<string> {
  const planId = await planIdBySlug(ds, 'performance-mensual');
  const [row] = await ds.query(
    `INSERT INTO subscriptions (user_id, plan_id, service, starts_on, ends_on) VALUES ($1, $2, 'performance', $3, $4) RETURNING id`,
    [userId, planId, input.startsOn, input.endsOn],
  );
  return row.id as string;
}

export async function givePack(
  ds: DataSource,
  userId: string,
  input: { startsOn: string; endsOn: string; total: number; used?: number },
): Promise<string> {
  const planId = await planIdBySlug(ds, 'recovery-paquete-4');
  const [row] = await ds.query(
    `INSERT INTO subscriptions (user_id, plan_id, service, starts_on, ends_on, sessions_total, sessions_used)
     VALUES ($1, $2, 'recovery', $3, $4, $5, $6) RETURNING id`,
    [userId, planId, input.startsOn, input.endsOn, input.total, input.used ?? 0],
  );
  return row.id as string;
}
