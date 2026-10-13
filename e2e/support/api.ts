// Cliente HTTP de la API de E2E para preparar datos (sesión por cookie, como la web).
import { randomInt } from 'node:crypto';
import { request, type APIRequestContext } from '@playwright/test';
import { E2E_API_URL, E2E_WEB_URL } from '../../scripts/e2e/env.mjs';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

// Una IP inventada por cliente HTTP o por página: la API de E2E confía en un salto de X-Forwarded-For
// (TRUST_PROXY_HOPS=1), así el throttling del checkout cuenta cada prueba por separado.
export function fakeIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

export class ApiClient {
  private constructor(private readonly context: APIRequestContext) {}

  static async create(): Promise<ApiClient> {
    const context = await request.newContext({ extraHTTPHeaders: { origin: E2E_WEB_URL, 'x-forwarded-for': fakeIp() } });
    return new ApiClient(context);
  }

  static async signIn(email: string, password: string): Promise<ApiClient> {
    const client = await ApiClient.create();
    await client.call('POST', '/auth/sign-in/email', { email, password });
    return client;
  }

  async call<T = unknown>(method: Method, path: string, body?: unknown): Promise<T> {
    const response = await this.context.fetch(`${E2E_API_URL}${path}`, { method, data: body });
    const text = await response.text();
    if (!response.ok()) {
      const code = text.startsWith('{') ? (JSON.parse(text) as { code?: string }).code : undefined;
      throw new Error(`${method} ${path} → ${response.status()}${code ? ` ${code}` : ''}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}
