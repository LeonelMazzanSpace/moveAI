import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it('accepts internal paths for the right role', () => {
    expect(safeNextPath('/perfil', 'client')).toBe('/perfil');
    expect(safeNextPath('/staff/turnos?fecha=2026-10-12', 'staff')).toBe('/staff/turnos?fecha=2026-10-12');
    expect(safeNextPath('/performance', 'client')).toBe('/performance');
  });

  it('rejects external and cross-role paths', () => {
    expect(safeNextPath('https://evil.com', 'client')).toBeNull();
    expect(safeNextPath('//evil.com', 'client')).toBeNull();
    expect(safeNextPath('/staff', 'client')).toBeNull();
    expect(safeNextPath('/perfil', 'staff')).toBeNull();
    expect(safeNextPath(undefined, 'client')).toBeNull();
  });

  it('rejects backslash and control-character tricks that browsers normalize to external URLs', () => {
    expect(safeNextPath('/\\evil.com', 'client')).toBeNull();
    expect(safeNextPath('/\t/evil.com', 'client')).toBeNull();
    expect(safeNextPath('', 'client')).toBeNull();
    expect(safeNextPath(null, 'staff')).toBeNull();
  });

  it('does not treat lookalike prefixes as the staff area or client area', () => {
    expect(safeNextPath('/staffing', 'client')).toBe('/staffing');
    expect(safeNextPath('/staffing', 'staff')).toBe('/staffing');
    expect(safeNextPath('/perfilx', 'staff')).toBe('/perfilx');
  });

  it('keeps client-only routes away from staff', () => {
    expect(safeNextPath('/historial', 'staff')).toBeNull();
    expect(safeNextPath('/check-in', 'staff')).toBeNull();
    expect(safeNextPath('/reservar/fisioterapia', 'staff')).toBeNull();
    expect(safeNextPath('/checkout/plan/trimestral', 'staff')).toBeNull();
    expect(safeNextPath('/perfil#avisos', 'staff')).toBeNull();
  });
});
