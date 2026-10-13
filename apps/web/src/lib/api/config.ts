export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export function apiOrigin(): string {
  return API_URL.replace(/\/api\/?$/, '');
}

export type ApiQuery = Record<string, string | number | boolean | undefined>;

export interface ApiRequestInit {
  method?: string;
  body?: unknown;
  query?: ApiQuery;
}

export function buildApiUrl(path: string, query?: ApiQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_URL}${path}${search ? `?${search}` : ''}`;
}
