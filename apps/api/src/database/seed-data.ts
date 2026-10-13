import type { DataSource, EntityManager } from 'typeorm';
import type { PlanKind, Service } from '../modules/catalog/entities/plan.entity.js';
import { SETTING_DB_KEYS, SETTINGS_DEFAULTS } from '../modules/settings/settings.defaults.js';

// Provisional catalog and schedule taken from the mockups (D4/D10): confirm with MOVE.

type SeedPlan = {
  slug: string;
  service: Service;
  kind: PlanKind;
  name: string;
  price: number;
  periodMonths: number | null;
  periodDays: number | null;
  sessionsIncluded: number | null;
  durationMinutes: number | null;
  featured: boolean;
  sortOrder: number;
  features: string[];
};

type SeedTemplateGroup = {
  service: Service;
  times: string[];
  durationMinutes: number;
  capacity: number;
  withProfessional: boolean;
};

const DESCRIPTIONS: Record<Service, string> = {
  performance: 'Entrenamiento semi personalizado por reserva, sin límite semanal.',
  rehab: 'Puerta de entrada a Rehab: evaluamos y definimos el abordaje.',
  recovery: 'Recovery Room by MOVE, abierta a todo público.',
};

const PERFORMANCE_FEATURES = [
  'Asistencias ilimitadas con reserva',
  'Reserva y cancelación online',
  'Historial de entrenamiento',
];

const SEED_PLANS: SeedPlan[] = [
  {
    slug: 'performance-mensual', service: 'performance', kind: 'period_plan', name: 'Plan Mensual', price: 3900,
    periodMonths: 1, periodDays: null, sessionsIncluded: null, durationMinutes: null, featured: false, sortOrder: 1,
    features: PERFORMANCE_FEATURES,
  },
  {
    slug: 'performance-trimestral', service: 'performance', kind: 'period_plan', name: 'Plan Trimestral', price: 10500,
    periodMonths: 3, periodDays: null, sessionsIncluded: null, durationMinutes: null, featured: true, sortOrder: 2,
    features: [...PERFORMANCE_FEATURES, 'Ahorrás un 10% vs. mensual'],
  },
  {
    slug: 'performance-semestral', service: 'performance', kind: 'period_plan', name: 'Plan Semestral', price: 19800,
    periodMonths: 6, periodDays: null, sessionsIncluded: null, durationMinutes: null, featured: false, sortOrder: 3,
    features: [...PERFORMANCE_FEATURES, 'Ahorrás un 15% vs. mensual'],
  },
  {
    slug: 'rehab-evaluacion', service: 'rehab', kind: 'evaluation', name: 'Evaluación y Diagnóstico', price: 1800,
    periodMonths: null, periodDays: null, sessionsIncluded: null, durationMinutes: 60, featured: false, sortOrder: 1,
    features: [
      'Evaluación inicial con fisioterapeuta',
      'Diagnóstico y plan de abordaje',
      'Abierta a alumnos y no alumnos',
    ],
  },
  {
    slug: 'recovery-sesion', service: 'recovery', kind: 'single_session', name: 'Sesión individual', price: 900,
    periodMonths: null, periodDays: null, sessionsIncluded: null, durationMinutes: 45, featured: false, sortOrder: 1,
    features: ['Sesión de 45 minutos', 'Reserva online con pago inmediato', 'Sin compromiso mensual'],
  },
  {
    slug: 'recovery-paquete-4', service: 'recovery', kind: 'session_pack', name: 'Paquete 4 sesiones', price: 3200,
    periodMonths: null, periodDays: 30, sessionsIncluded: 4, durationMinutes: 45, featured: true, sortOrder: 2,
    features: ['4 sesiones en 30 días', 'Reservá en cualquier horario disponible', 'Ahorrás un 11%'],
  },
  {
    slug: 'recovery-paquete-8', service: 'recovery', kind: 'session_pack', name: 'Paquete 8 sesiones', price: 5900,
    periodMonths: null, periodDays: 30, sessionsIncluded: 8, durationMinutes: 45, featured: false, sortOrder: 3,
    features: ['8 sesiones en 30 días', 'Reservá en cualquier horario disponible', 'Ahorrás un 18%'],
  },
];

const SEED_PROFESSIONAL_NAME = 'Fisioterapeuta MOVE';

// Monday to Friday (ISO weekdays 1–5).
const SEED_WEEKDAYS = [1, 2, 3, 4, 5];

const SEED_TEMPLATE_GROUPS: SeedTemplateGroup[] = [
  {
    service: 'performance',
    times: ['07:00', '08:00', '09:00', '17:00', '18:00', '19:00', '20:00', '21:00'],
    durationMinutes: 60,
    capacity: 14,
    withProfessional: false,
  },
  {
    service: 'recovery',
    times: ['08:00', '09:00', '10:00', '17:00', '18:30', '19:30'],
    durationMinutes: 45,
    capacity: 2,
    withProfessional: false,
  },
  {
    service: 'rehab',
    times: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
    durationMinutes: 60,
    capacity: 1,
    withProfessional: true,
  },
];

export async function insertDefaultSettings(dataSource: DataSource): Promise<void> {
  const keys = Object.keys(SETTINGS_DEFAULTS) as (keyof typeof SETTINGS_DEFAULTS)[];
  const placeholders = keys.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}::jsonb)`).join(', ');
  const params = keys.flatMap((key) => [SETTING_DB_KEYS[key], JSON.stringify(SETTINGS_DEFAULTS[key])]);
  await dataSource.query(`INSERT INTO settings (key, value) VALUES ${placeholders} ON CONFLICT (key) DO NOTHING`, params);
}

async function insertPlans(manager: EntityManager): Promise<number> {
  let inserted = 0;
  for (const plan of SEED_PLANS) {
    const rows: { id: string }[] = await manager.query(
      `INSERT INTO plans (slug, service, kind, name, description, features, price, period_months, period_days,
         sessions_included, duration_minutes, featured, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id`,
      [
        plan.slug, plan.service, plan.kind, plan.name, DESCRIPTIONS[plan.service], plan.features, plan.price,
        plan.periodMonths, plan.periodDays, plan.sessionsIncluded, plan.durationMinutes, plan.featured, plan.sortOrder,
      ],
    );
    inserted += rows.length;
  }
  return inserted;
}

async function ensureProfessional(manager: EntityManager): Promise<{ id: string; inserted: number }> {
  const inserted: { id: string }[] = await manager.query(
    `INSERT INTO professionals (name)
     SELECT $1::text WHERE NOT EXISTS (SELECT 1 FROM professionals WHERE name = $1 AND deleted_at IS NULL)
     RETURNING id`,
    [SEED_PROFESSIONAL_NAME],
  );
  if (inserted.length > 0) return { id: inserted[0].id, inserted: 1 };
  const [existing]: { id: string }[] = await manager.query(
    `SELECT id FROM professionals WHERE name = $1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1`,
    [SEED_PROFESSIONAL_NAME],
  );
  return { id: existing.id, inserted: 0 };
}

async function insertTemplates(manager: EntityManager, professionalId: string): Promise<number> {
  let inserted = 0;
  for (const group of SEED_TEMPLATE_GROUPS) {
    const groupProfessionalId = group.withProfessional ? professionalId : null;
    for (const weekday of SEED_WEEKDAYS) {
      for (const time of group.times) {
        const rows: { id: string }[] = await manager.query(
          `INSERT INTO schedule_templates (service, weekday, start_time, duration_minutes, capacity, professional_id)
           SELECT $1::text, $2::smallint, $3::time, $4::smallint, $5::smallint, $6::uuid
           WHERE NOT EXISTS (
             SELECT 1 FROM schedule_templates
             WHERE service = $1 AND weekday = $2 AND start_time = $3::time
               AND professional_id IS NOT DISTINCT FROM $6::uuid AND active AND deleted_at IS NULL
           )
           RETURNING id`,
          [group.service, weekday, time, group.durationMinutes, group.capacity, groupProfessionalId],
        );
        inserted += rows.length;
      }
    }
  }
  return inserted;
}

// Idempotent: returns how many rows this run inserted.
export async function seedCatalogAndSchedule(
  dataSource: DataSource,
): Promise<{ plans: number; professionals: number; templates: number }> {
  return dataSource.transaction(async (manager) => {
    const plans = await insertPlans(manager);
    const professional = await ensureProfessional(manager);
    const templates = await insertTemplates(manager, professional.id);
    return { plans, professionals: professional.inserted, templates };
  });
}
