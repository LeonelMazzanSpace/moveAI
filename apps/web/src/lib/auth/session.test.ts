import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); });
vi.mock('next/navigation', () => ({ redirect }));
const serverApiFetchOrNull = vi.fn();
vi.mock('@/lib/api/server', () => ({ serverApiFetchOrNull }));
const requestHeaders = new Headers();
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(requestHeaders) }));

const { requireRole } = await import('./session');

describe('requireRole', () => {
  beforeEach(() => {
    redirect.mockClear();
    serverApiFetchOrNull.mockReset();
    requestHeaders.delete('x-move-path');
  });

  it('sends anonymous users to login with the area root when the path header is missing', async () => {
    serverApiFetchOrNull.mockResolvedValue(null);
    await expect(requireRole('client', '/perfil')).rejects.toThrow('REDIRECT:/ingresar?next=%2Fperfil');
  });

  it('sends anonymous users back to the exact page they asked for', async () => {
    serverApiFetchOrNull.mockResolvedValue(null);
    requestHeaders.set('x-move-path', '/checkout/plan/trimestral');
    await expect(requireRole('client', '/perfil')).rejects.toThrow('REDIRECT:/ingresar?next=%2Fcheckout%2Fplan%2Ftrimestral');
    requestHeaders.set('x-move-path', '/check-in');
    await expect(requireRole('client', '/perfil')).rejects.toThrow('REDIRECT:/ingresar?next=%2Fcheck-in');
  });

  it('keeps the query string of the requested page', async () => {
    serverApiFetchOrNull.mockResolvedValue(null);
    requestHeaders.set('x-move-path', '/staff/turnos?fecha=2026-10-12');
    await expect(requireRole('staff', '/staff')).rejects.toThrow('REDIRECT:/ingresar?next=%2Fstaff%2Fturnos%3Ffecha%3D2026-10-12');
  });

  it('falls back to the area root when the path header is unsafe or belongs to another role', async () => {
    serverApiFetchOrNull.mockResolvedValue(null);
    requestHeaders.set('x-move-path', '//evil.com');
    await expect(requireRole('client', '/perfil')).rejects.toThrow('REDIRECT:/ingresar?next=%2Fperfil');
    requestHeaders.set('x-move-path', '/perfil/../staff');
    await expect(requireRole('client', '/perfil')).rejects.toThrow('REDIRECT:/ingresar?next=%2Fperfil');
    requestHeaders.set('x-move-path', '/staff');
    await expect(requireRole('client', '/perfil')).rejects.toThrow('REDIRECT:/ingresar?next=%2Fperfil');
  });

  it('sends staff away from the client area and clients away from staff', async () => {
    serverApiFetchOrNull.mockResolvedValue({ id: '1', role: 'staff' });
    await expect(requireRole('client', '/perfil')).rejects.toThrow('REDIRECT:/staff');
    serverApiFetchOrNull.mockResolvedValue({ id: '2', role: 'client' });
    await expect(requireRole('staff', '/staff')).rejects.toThrow('REDIRECT:/perfil');
  });

  it('returns the user when the role matches', async () => {
    serverApiFetchOrNull.mockResolvedValue({ id: '2', role: 'client' });
    await expect(requireRole('client', '/perfil')).resolves.toMatchObject({ id: '2' });
  });
});
