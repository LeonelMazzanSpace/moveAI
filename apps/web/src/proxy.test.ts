// @vitest-environment node
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

const SESSION_COOKIE = 'better-auth.session_token';
const SECURE_SESSION_COOKIE = '__Secure-better-auth.session_token';

function forwardedPath(url: string, headers: Record<string, string> = {}): string | null {
  const response = proxy(new NextRequest(`http://localhost${url}`, { headers: { cookie: `${SESSION_COOKIE}=abc123`, ...headers } }));
  return response.headers.get('x-middleware-request-x-move-path');
}

function anonymous(url: string) {
  return proxy(new NextRequest(`http://localhost${url}`));
}

function loginRedirect(url: string): URL {
  const response = anonymous(url);
  expect(response.status, url).toBe(307);
  return new URL(response.headers.get('location') ?? '');
}

describe('proxy', () => {
  it('forwards the requested path and query, overwriting any value sent by the browser', () => {
    expect(forwardedPath('/checkout/plan/trimestral?x=1')).toBe('/checkout/plan/trimestral?x=1');
    expect(forwardedPath('/perfil', { 'x-move-path': '/historial' })).toBe('/perfil');
  });

  it('runs on guarded pages whose path has a dot, so x-move-path is kept', () => {
    expect(unstable_doesMiddlewareMatch({ config, url: '/checkout/plan/a.b' })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: '/staff/clientes/ana.perez' })).toBe(true);
    expect(forwardedPath('/checkout/plan/a.b')).toBe('/checkout/plan/a.b');
  });

  it('runs on regular pages', () => {
    for (const url of ['/', '/perfil', '/staff/turnos', '/ingresar']) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
  });

  describe('anonymous visitors of protected routes', () => {
    it('redirects staff routes to the login with the path and query as next', () => {
      const location = loginRedirect('/staff/turnos?fecha=2026-10-12&servicio=performance');
      expect(location.origin).toBe('http://localhost');
      expect(location.pathname).toBe('/ingresar');
      expect(location.searchParams.get('next')).toBe('/staff/turnos?fecha=2026-10-12&servicio=performance');
    });

    it('redirects every protected route of both areas', () => {
      const urls = ['/staff', '/perfil', '/historial', '/check-in', '/reservar/fisioterapia', '/checkout/plan/trimestral'];
      for (const url of urls) {
        const location = loginRedirect(url);
        expect(location.pathname, url).toBe('/ingresar');
        expect(location.searchParams.get('next'), url).toBe(url);
      }
    });

    it('does not set x-move-path on the redirect', () => {
      expect(anonymous('/perfil').headers.get('x-middleware-request-x-move-path')).toBeNull();
    });

    it('lets visitors with a session cookie through, whatever its name', () => {
      for (const name of [SESSION_COOKIE, SECURE_SESSION_COOKIE]) {
        const request = new NextRequest('http://localhost/staff/turnos?x=1', { headers: { cookie: `${name}=abc123` } });
        const response = proxy(request);
        expect(response.status, name).toBe(200);
        expect(response.headers.get('location'), name).toBeNull();
        expect(response.headers.get('x-middleware-request-x-move-path'), name).toBe('/staff/turnos?x=1');
      }
    });

    it('still redirects when the cookies are unrelated or the session cookie is empty', () => {
      for (const cookie of ['theme=dark', 'better-auth.session_data=abc', `${SESSION_COOKIE}=`]) {
        const response = proxy(new NextRequest('http://localhost/perfil', { headers: { cookie } }));
        expect(response.status, cookie).toBe(307);
      }
    });

    it('leaves public routes alone', () => {
      const urls = ['/', '/performance', '/planes?service=recovery', '/reservar', '/ingresar', '/checkout/resultado?ref=1', '/staffing', '/perfilx'];
      for (const url of urls) {
        const response = anonymous(url);
        expect(response.status, url).toBe(200);
        expect(response.headers.get('location'), url).toBeNull();
        expect(response.headers.get('x-middleware-request-x-move-path'), url).toBe(url);
      }
    });

    it('is not mounted on the API', () => {
      expect(unstable_doesMiddlewareMatch({ config, url: '/api/staff/clients' })).toBe(false);
    });

    it('normalizes a hostile path before using it as next', () => {
      const location = loginRedirect('/perfil/%2e%2e/staff/clientes?q=a');
      expect(location.pathname).toBe('/ingresar');
      expect(location.searchParams.get('next')).toBe('/staff/clientes?q=a');
    });

  });

  it('skips the API, Next internals and real static files', () => {
    const skipped = [
      '/api/me',
      '/_next/static/chunks/main.js',
      '/_next/image',
      '/favicon.ico',
      '/logo.png',
      '/foto.jpg',
      '/foto.jpeg',
      '/icono.svg',
      '/imagen.webp',
      '/robots.txt',
      '/sitemap.xml',
      '/estilos.css',
      '/script.js',
      '/script.js.map',
    ];
    for (const url of skipped) {
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(false);
    }
  });
});
