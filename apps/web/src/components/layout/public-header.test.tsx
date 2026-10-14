import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const { PublicHeader } = await import('./public-header');

describe('PublicHeader', () => {
  it('offers login to anonymous visitors', () => {
    render(<PublicHeader user={null} />);
    expect(screen.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/ingresar');
  });

  it('offers the profile to clients', () => {
    render(<PublicHeader user={{ role: 'client' }} />);
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('href', '/perfil');
    expect(screen.queryByRole('link', { name: 'Ingresar' })).not.toBeInTheDocument();
  });

  it('offers the panel to staff', () => {
    render(<PublicHeader user={{ role: 'staff' }} />);
    expect(screen.getByRole('link', { name: 'Panel' })).toHaveAttribute('href', '/staff');
  });

  it('always shows the public navigation and the booking button', () => {
    render(<PublicHeader user={null} />);
    expect(screen.getByRole('link', { name: 'Reservar' })).toHaveAttribute('href', '/reservar');
    const links: [string, string][] = [
      ['Inicio', '/'],
      ['Equipo', '/#equipo'],
      ['Performance', '/performance'],
      ['Rehab', '/rehab'],
      ['Recovery', '/recovery'],
      ['Planes', '/planes'],
    ];
    for (const [name, href] of links) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });
});
