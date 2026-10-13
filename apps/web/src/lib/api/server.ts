import 'server-only';
import { headers } from 'next/headers';
import { buildApiUrl, type ApiRequestInit } from './config';
import { ApiError, networkError, readApiResponse } from './errors';

export async function serverApiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const incoming = await headers();
  const cookie = incoming.get('cookie');
  const hasBody = init.body !== undefined;
  const requestHeaders: Record<string, string> = {};
  if (cookie) requestHeaders.cookie = cookie;
  if (hasBody) requestHeaders['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path, init.query), {
      method: init.method ?? 'GET',
      headers: requestHeaders,
      body: hasBody ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw networkError();
  }
  return readApiResponse<T>(response);
}

export async function serverApiFetchOrNull<T>(path: string): Promise<T | null> {
  try {
    return await serverApiFetch<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
