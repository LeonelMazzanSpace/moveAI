import type { Service } from '../../catalog/entities/plan.entity.js';

export const SERVICES: Service[] = ['performance', 'rehab', 'recovery'];
export const START_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
// Years are bounded so a value such as `0000-01-01` never reaches Postgres.
export const DATE_PATTERN = /^20\d{2}-\d{2}-\d{2}$/;
export const NAME_LENGTH = { min: 2, max: 80 } as const;
export const DURATION_MINUTES = { min: 15, max: 240 } as const;
export const CAPACITY = { min: 1, max: 100 } as const;
export const WEEKDAY = { min: 1, max: 7 } as const;
export const GENERATE_DAYS = { min: 1, max: 60 } as const;
// Postgres text cannot store NUL bytes: reject them at the edge instead of failing with a 500.
export const NUL = '\u0000';

export const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
