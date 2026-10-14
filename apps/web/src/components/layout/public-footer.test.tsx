import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContactInfoDto } from '@/lib/api/types';

const loadContact = vi.fn();
vi.mock('@/components/public/load-contact', () => ({ loadContact }));

const { FooterContact, PublicFooter } = await import('./public-footer');

const FULL: ContactInfoDto = {
  address: 'Máximo Tajes 6397 esquina Beranger',
  hours: 'Lunes a viernes · 7:00 – 11:00 · 15:00 – 20:00',
  whatsapp: '+598 99 140 299',
  instagram: '@move_strengthconditioning',
  email: 'hola@move.uy',
  mapsUrl: 'https://www.google.com/maps/place/MOVE',
};
const EMPTY: ContactInfoDto = { address: '', hours: '', whatsapp: '', instagram: '', email: '', mapsUrl: '' };

async function renderContact() {
  return render(await FooterContact());
}

describe('PublicFooter contact block', () => {
  beforeEach(() => {
    loadContact.mockReset();
  });

  it('shows every datum with its link', async () => {
    loadContact.mockResolvedValue(FULL);
    await renderContact();
    expect(screen.getByText(FULL.address)).toBeInTheDocument();
    expect(screen.getByText(FULL.hours)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: FULL.whatsapp })).toHaveAttribute('href', 'https://wa.me/59899140299');
    expect(screen.getByRole('link', { name: FULL.instagram })).toHaveAttribute(
      'href',
      'https://www.instagram.com/move_strengthconditioning/',
    );
    expect(screen.getByRole('link', { name: FULL.email })).toHaveAttribute('href', 'mailto:hola@move.uy');
  });

  it('opens Google Maps in a new tab without leaking the opener', async () => {
    loadContact.mockResolvedValue(FULL);
    await renderContact();
    const maps = screen.getByRole('link', { name: 'Abrir en Google Maps' });
    expect(maps).toHaveAttribute('href', FULL.mapsUrl);
    expect(maps).toHaveAttribute('target', '_blank');
    expect(maps).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('omits the fields that are empty', async () => {
    loadContact.mockResolvedValue({ ...EMPTY, address: 'Calle 1', email: 'hola@move.uy' });
    await renderContact();
    expect(screen.getByText('Calle 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hola@move.uy' })).toBeInTheDocument();
    expect(screen.queryByText('WhatsApp')).toBeNull();
    expect(screen.queryByText('Instagram')).toBeNull();
    expect(screen.queryByText('Horarios')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Abrir en Google Maps' })).toBeNull();
  });

  it('renders nothing when every field is empty', async () => {
    loadContact.mockResolvedValue(EMPTY);
    const { container } = await renderContact();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the contact could not be loaded', async () => {
    loadContact.mockResolvedValue(null);
    const { container } = await renderContact();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PublicFooter', () => {
  it('keeps the brand, the service links and the copyright when there is no contact block', () => {
    loadContact.mockResolvedValue(null);
    render(<PublicFooter />);
    expect(screen.getByRole('link', { name: 'Performance' })).toHaveAttribute('href', '/performance');
    expect(screen.getByRole('link', { name: 'Rehab' })).toHaveAttribute('href', '/rehab');
    expect(screen.getByRole('link', { name: 'Recovery' })).toHaveAttribute('href', '/recovery');
    expect(screen.getByText(/© 2026 MOVE/)).toBeInTheDocument();
  });
});
