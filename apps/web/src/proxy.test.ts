// @vitest-environment node
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

function forwardedPath(url: string, headers: Record<string, string> = {}): string | null {
  const response = proxy(new NextRequest(`http://localhost${url}`, { headers }));
  return response.headers.get('x-middleware-request-x-move-path');
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
