import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { ContactInfoDto } from '@/lib/api/types';

const serverApiFetch = vi.fn();
vi.mock('@/lib/api/server', () => ({ serverApiFetch }));

const { loadContact } = await import('./load-contact');
const { ContactSection } = await import('./contact-section');

const FULL: ContactInfoDto = {
  address: 'Máximo Tajes 6397 esquina Beranger',
  hours: 'Lunes a viernes · 7:00 – 11:00 · 15:00 – 20:00',
  whatsapp: '+598 99 140 299',
  instagram: '@move_strengthconditioning',
  email: 'hola@move.uy',
  mapsUrl: 'https://www.google.com/maps/place/MOVE',
};
const EMPTY: ContactInfoDto = { address: '', hours: '', whatsapp: '', instagram: '', email: '', mapsUrl: '' };

describe('ContactSection', () => {
  it('has its eyebrow and the "Dónde estamos" heading', () => {
    render(<ContactSection contact={FULL} />);
    expect(screen.getByText('04 — Contacto')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dónde estamos' })).toBeInTheDocument();
  });

  it('shows every contact datum', () => {
    render(<ContactSection contact={FULL} />);
    expect(screen.getByText(FULL.address)).toBeInTheDocument();
    expect(screen.getByText(FULL.hours)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: FULL.whatsapp })).toHaveAttribute('href', 'https://wa.me/59899140299');
    expect(screen.getByRole('link', { name: FULL.instagram })).toHaveAttribute(
      'href',
      'https://www.instagram.com/move_strengthconditioning/',
    );
    expect(screen.getByRole('link', { name: FULL.email })).toHaveAttribute('href', 'mailto:hola@move.uy');
  });

  it('offers the Maps and WhatsApp calls to action', () => {
    render(<ContactSection contact={FULL} />);
    expect(screen.getByRole('link', { name: 'Abrir en Google Maps' })).toHaveAttribute('href', FULL.mapsUrl);
    expect(screen.getByRole('link', { name: 'Escribinos por WhatsApp' })).toHaveAttribute('href', 'https://wa.me/59899140299');
  });

  it('omits the empty fields and the calls to action that have no data', () => {
    render(<ContactSection contact={{ ...EMPTY, address: 'Calle 1' }} />);
    expect(screen.getByText('Calle 1')).toBeInTheDocument();
    expect(screen.queryByText('Horarios')).toBeNull();
    expect(screen.queryByText('WhatsApp')).toBeNull();
    expect(screen.queryByText('Instagram')).toBeNull();
    expect(screen.queryByText('Email')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Abrir en Google Maps' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Escribinos por WhatsApp' })).toBeNull();
  });

  it('renders nothing when there is no datum at all', () => {
    const { container } = render(<ContactSection contact={EMPTY} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the contact could not be loaded', () => {
    const { container } = render(<ContactSection contact={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('loadContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the public contact settings and returns them', async () => {
    serverApiFetch.mockResolvedValue(FULL);

    await expect(loadContact()).resolves.toEqual(FULL);
    expect(serverApiFetch).toHaveBeenCalledWith('/settings/contact');
  });

  it('fills a missing or null field with an empty string, so a partial answer cannot break the render', async () => {
    serverApiFetch.mockResolvedValue({ address: 'Calle 1', hours: null, email: 42 });

    await expect(loadContact()).resolves.toEqual({ ...EMPTY, address: 'Calle 1' });
  });

  it.each([null, undefined, 'texto', 7])('degrades to null for the non-object answer %j', async (payload) => {
    serverApiFetch.mockResolvedValue(payload);

    await expect(loadContact()).resolves.toBeNull();
  });

  it('degrades to null when the API fails', async () => {
    serverApiFetch.mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));

    await expect(loadContact()).resolves.toBeNull();
  });

  it('does not swallow the control-flow errors of Next', async () => {
    serverApiFetch.mockImplementation(() => notFound());

    await expect(loadContact()).rejects.toMatchObject({ digest: expect.stringContaining('404') });
  });
});

describe('ContactSection with long values and incomplete data', () => {
  const LONG_EMAIL = `${'a'.repeat(60)}@${'subdominio'.repeat(10)}.example.com`;
  const LONG_ADDRESS = 'Avenida'.repeat(30);

  it('breaks long values anywhere and lets every grid item shrink, so nothing pushes the page sideways', () => {
    render(<ContactSection contact={{ ...FULL, email: LONG_EMAIL, address: LONG_ADDRESS }} />);
    for (const value of [LONG_ADDRESS, LONG_EMAIL]) {
      const dd = screen.getByText(value).closest('dd');
      expect(dd).toHaveClass('[overflow-wrap:anywhere]');
      expect(dd?.parentElement).toHaveClass('min-w-0');
    }
  });

  it('links the long email to its own mailto', () => {
    render(<ContactSection contact={{ ...FULL, email: LONG_EMAIL }} />);
    expect(screen.getByRole('link', { name: LONG_EMAIL })).toHaveAttribute('href', `mailto:${LONG_EMAIL}`);
  });
});
