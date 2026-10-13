import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let pathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: vi.fn() }),
}));
const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut: vi.fn() } }));
// Real anchors make jsdom log "navigation to another Document"; the menu only needs the click handler.
vi.mock('next/link', () => ({
  default: ({ href, onClick, children, ...props }: ComponentProps<'a'>) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

const { ClientHeader } = await import('./client-header');
const { PublicHeader } = await import('./public-header');
const { StaffTopbar } = await import('./staff-topbar');

function renderWithQuery(ui: ReactElement, queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
  return { user, dialog: await screen.findByRole('dialog') };
}

function linkNames(container: HTMLElement): string[] {
  return within(container)
    .getAllByRole('link')
    .map((link) => link.textContent ?? '');
}

describe('MobileNav in the staff area', () => {
  beforeEach(() => {
    pathname = '/staff/turnos';
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({ total: 7 });
  });

  it('has the hamburger button and keeps the menu closed until it is pressed', () => {
    renderWithQuery(<StaffTopbar name="Ana Pérez" />);
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists exactly the sidebar items with their hrefs and marks only the current one', async () => {
    renderWithQuery(<StaffTopbar name="Ana Pérez" />);
    const { dialog } = await openMenu();
    const nav = within(dialog).getByRole('navigation');
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => [link.textContent?.replace(/\d+$/, ''), link.getAttribute('href')])).toEqual([
      ['Dashboard', '/staff'],
      ['Clientes', '/staff/clientes'],
      ['Turnos y asistencia', '/staff/turnos'],
      ['Pagos', '/staff/pagos'],
      ['Seguimiento', '/staff/seguimiento'],
      ['Check-in', '/staff/seguimiento/check-in'],
      ['Configuración', '/staff/configuracion'],
    ]);
    const current = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Turnos y asistencia']);
  });

  it('fetches the open alerts total from the staff alerts endpoint and shows it on Seguimiento', async () => {
    renderWithQuery(<StaffTopbar name="Ana Pérez" />);
    const { dialog } = await openMenu();
    const seguimiento = within(dialog).getByRole('link', { name: /^Seguimiento/ });
    expect(await within(seguimiento).findByText('7')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/staff/alerts/counts');
  });

  it('reads the badge from the shared query key, the one the sidebar fills', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['staff', 'alert-counts'], { total: 9 });
    apiFetch.mockReturnValue(new Promise(() => undefined));
    renderWithQuery(<StaffTopbar name="Ana Pérez" />, queryClient);
    const { dialog } = await openMenu();
    const seguimiento = within(dialog).getByRole('link', { name: /^Seguimiento/ });
    expect(within(seguimiento).getByText('9')).toBeInTheDocument();
  });

  it('hides the badge when there are no open alerts', async () => {
    apiFetch.mockResolvedValue({ total: 0 });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderWithQuery(<StaffTopbar name="Ana Pérez" />, queryClient);
    const { dialog } = await openMenu();
    await waitFor(() => expect(queryClient.getQueryData(['staff', 'alert-counts'])).toEqual({ total: 0 }));
    expect(within(dialog).getByRole('link', { name: 'Seguimiento' })).toHaveTextContent(/^Seguimiento$/);
    expect(within(dialog).queryByText('0')).not.toBeInTheDocument();
  });

  it('marks only Check-in as current on /staff/seguimiento/check-in', async () => {
    pathname = '/staff/seguimiento/check-in';
    renderWithQuery(<StaffTopbar name="Ana Pérez" />);
    const { dialog } = await openMenu();
    const current = within(dialog)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Check-in']);
  });

  it('closes the menu when a link is clicked', async () => {
    renderWithQuery(<StaffTopbar name="Ana Pérez" />);
    const { user, dialog } = await openMenu();
    await user.click(within(dialog).getByRole('link', { name: 'Pagos' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers the logout button and the user name inside the menu', async () => {
    renderWithQuery(<StaffTopbar name="Ana Pérez" />);
    const { dialog } = await openMenu();
    expect(within(dialog).getByRole('button', { name: 'Salir' })).toBeInTheDocument();
    expect(within(dialog).getByText('Ana Pérez')).toBeInTheDocument();
  });
});

describe('MobileNav in the client area', () => {
  beforeEach(() => {
    pathname = '/historial';
    apiFetch.mockReset();
    apiFetch.mockResolvedValue([]);
  });

  it('has the hamburger button and lists exactly the client links, marking the current one', async () => {
    renderWithQuery(<ClientHeader user={{ name: 'Lucía Gómez' }} />);
    const { dialog } = await openMenu();
    const nav = within(dialog).getByRole('navigation');
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Mi perfil', '/perfil'],
      ['Reservar', '/reservar'],
      ['Planes', '/planes'],
      ['Historial', '/historial'],
    ]);
    const current = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Historial']);
  });

  it('closes the menu when a link is clicked', async () => {
    renderWithQuery(<ClientHeader user={{ name: 'Lucía Gómez' }} />);
    const { user, dialog } = await openMenu();
    await user.click(within(dialog).getByRole('link', { name: 'Planes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers the logout button and the user name inside the menu', async () => {
    renderWithQuery(<ClientHeader user={{ name: 'Lucía Gómez' }} />);
    const { dialog } = await openMenu();
    expect(within(dialog).getByRole('button', { name: 'Salir' })).toBeInTheDocument();
    expect(within(dialog).getByText('Lucía Gómez')).toBeInTheDocument();
  });
});

describe('MobileNav in the public area', () => {
  beforeEach(() => {
    pathname = '/rehab';
  });

  it('has the hamburger button and lists the public links plus the account and booking buttons', async () => {
    render(<PublicHeader user={null} />);
    const { dialog } = await openMenu();
    expect(linkNames(dialog)).toEqual([
      'Inicio',
      'Performance',
      'Rehab',
      'Recovery',
      'Planes',
      'Ingresar',
      'Reservar',
    ]);
    expect(within(dialog).getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/ingresar');
    expect(within(dialog).getByRole('link', { name: 'Reservar' })).toHaveAttribute('href', '/reservar');
  });

  it('marks only the current public link', async () => {
    render(<PublicHeader user={null} />);
    const { dialog } = await openMenu();
    const current = within(dialog)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Rehab']);
  });

  it('marks Inicio only on the home page', async () => {
    pathname = '/';
    render(<PublicHeader user={null} />);
    const { dialog } = await openMenu();
    const current = within(dialog)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Inicio']);
  });

  it.each([
    [{ role: 'client' as const }, 'Mi perfil', '/perfil'],
    [{ role: 'staff' as const }, 'Panel', '/staff'],
  ])('offers the profile access instead of login for %o', async (user, label, href) => {
    render(<PublicHeader user={user} />);
    const { dialog } = await openMenu();
    expect(within(dialog).getByRole('link', { name: label })).toHaveAttribute('href', href);
    expect(within(dialog).queryByRole('link', { name: 'Ingresar' })).not.toBeInTheDocument();
  });

  it('closes the menu when a link is clicked', async () => {
    render(<PublicHeader user={null} />);
    const { user, dialog } = await openMenu();
    await user.click(within(dialog).getByRole('link', { name: 'Reservar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('MobileNav dismissal and focus', () => {
  beforeEach(() => {
    pathname = '/rehab';
  });

  it('closes with Escape and gives the focus back to the hamburger button', async () => {
    render(<PublicHeader user={null} />);
    const { user } = await openMenu();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus();
  });

  it('closes with the "Cerrar menú" button and gives the focus back to the hamburger button', async () => {
    render(<PublicHeader user={null} />);
    const { user, dialog } = await openMenu();
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar menú' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus();
  });

  it('closes when the page changes without a click on the menu, such as the browser Back button', async () => {
    const { rerender } = render(<PublicHeader user={null} />);
    await openMenu();
    pathname = '/recovery';
    rerender(<PublicHeader user={null} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
