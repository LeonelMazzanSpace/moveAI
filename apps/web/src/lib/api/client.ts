import { buildApiUrl, type ApiRequestInit } from './config';
import { networkError, readApiResponse } from './errors';

export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  let response: Response;
  try {
    response = await fetch(buildApiUrl(path, init.query), {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: hasBody ? { 'content-type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw networkError();
  }
  return readApiResponse<T>(response);
}
