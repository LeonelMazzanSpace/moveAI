import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';
import { ApiError } from './errors';

const mockFetch = (status: number, body?: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );

describe('apiFetch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends credentials, JSON and query', async () => {
    const spy = mockFetch(200, { ok: true });
    await apiFetch('/bookings', { method: 'POST', body: { timeSlotId: 'x' }, query: { scope: 'upcoming', skip: undefined } });
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/bookings\?scope=upcoming$/);
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', body: JSON.stringify({ timeSlotId: 'x' }) });
  });

  it('throws ApiError with the API code', async () => {
    mockFetch(409, { statusCode: 409, code: 'SLOT_FULL', message: 'El turno está completo.' });
    await expect(apiFetch('/bookings', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 409, code: 'SLOT_FULL' });
  });

  it('returns undefined on 204', async () => {
    mockFetch(204);
    await expect(apiFetch('/staff/plans/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('wraps network failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    await expect(apiFetch('/health')).rejects.toBeInstanceOf(ApiError);
  });
});
