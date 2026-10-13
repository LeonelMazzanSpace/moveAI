import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let pathname = '/staff/turnos';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));

const { StaffSidebar } = await import('./staff-sidebar');

function renderSidebar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <StaffSidebar />
    </QueryClientProvider>,
  );
}

describe('StaffSidebar', () => {
  beforeEach(() => {
    pathname = '/staff/turnos';
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({ total: 23 });
  });

  it('renders the six sections plus the check-in subitem with their hrefs', () => {
    renderSidebar();
    const expected: [string, string][] = [
      ['Dashboard', '/staff'],
      ['Clientes', '/staff/clientes'],
      ['Turnos y asistencia', '/staff/turnos'],
      ['Pagos', '/staff/pagos'],
      ['Seguimiento', '/staff/seguimiento'],
      ['Check-in', '/staff/seguimiento/check-in'],
      ['Configuración', '/staff/configuracion'],
    ];
    for (const [name, href] of expected) {
      expect(screen.getByRole('link', { name: new RegExp(`^${name}`) })).toHaveAttribute('href', href);
    }
  });

  it('marks the active item with aria-current and no other', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Turnos y asistencia' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Clientes' })).not.toHaveAttribute('aria-current');
  });

  it('marks only Check-in, never Seguimiento too, on /staff/seguimiento/check-in', () => {
    pathname = '/staff/seguimiento/check-in';
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Check-in' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /^Seguimiento/ })).not.toHaveAttribute('aria-current');
  });

  it('marks Seguimiento on /staff/seguimiento', () => {
    pathname = '/staff/seguimiento';
    renderSidebar();
    expect(screen.getByRole('link', { name: /^Seguimiento/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Check-in' })).not.toHaveAttribute('aria-current');
  });

  it('shows the open alerts total as a badge', async () => {
    renderSidebar();
    expect(await screen.findByText('23')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/staff/alerts/counts');
  });

  it('hides the badge when there are no open alerts', async () => {
    apiFetch.mockResolvedValue({ total: 0 });
    renderSidebar();
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
