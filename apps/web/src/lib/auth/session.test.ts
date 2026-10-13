import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); });
vi.mock('next/navigation', () => ({ redirect }));
const serverApiFetchOrNull = vi.fn();
vi.mock('@/lib/api/server', () => ({ serverApiFetchOrNull }));

const { requireRole } = await import('./session');

describe('requireRole', () => {
  beforeEach(() => { redirect.mockClear(); serverApiFetchOrNull.mockReset(); });

  it('sends anonymous users to login with next', async () => {
    serverApiFetchOrNull.mockResolvedValue(null);
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
