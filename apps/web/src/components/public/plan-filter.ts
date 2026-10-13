import type { Service } from '@/lib/api/types';

export type CatalogService = Extract<Service, 'performance' | 'recovery'>;
export type PlanFilter = CatalogService | undefined;

export const FILTERS: { label: string; value: PlanFilter }[] = [
  { label: 'Todos', value: undefined },
  { label: 'Performance', value: 'performance' },
  { label: 'Recovery', value: 'recovery' },
];

export function parseFilter(value: string | string[] | undefined): PlanFilter {
  return value === 'performance' || value === 'recovery' ? value : undefined;
}

/** Catálogos que muestra `/planes` para el filtro elegido. */
export function servicesFor(filter: PlanFilter): CatalogService[] {
  return filter ? [filter] : ['performance', 'recovery'];
}
