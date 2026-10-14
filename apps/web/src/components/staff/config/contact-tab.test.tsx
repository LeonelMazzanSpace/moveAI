import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { StaffContactInfoDto } from '@/lib/api/types';

const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const { ContactTab } = await import('./contact-tab');

const CURRENT: StaffContactInfoDto = {
  address: 'Máximo Tajes 6397 esquina Beranger',
  hours: 'Lunes a viernes · 7:00 – 11:00 · 15:00 – 20:00',
  whatsapp: '+598 99 140 299',
  instagram: '@move_strengthconditioning',
  email: '',
  mapsUrl: 'https://www.google.com/maps/place/MOVE',
  staffNotificationsEmail: '',
};

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ContactTab />
    </QueryClientProvider>,
  );
}

function patchCalls() {
  return apiFetch.mock.calls.filter(([, init]) => init?.method === 'PATCH');
}

async function replaceValue(label: string, value: string) {
  const field = await screen.findByLabelText(label);
  await userEvent.clear(field);
  if (value) await userEvent.type(field, value);
  return field;
}

const save = () => userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

describe('ContactTab', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (_path: string, init?: { method?: string; body?: Partial<StaffContactInfoDto> }) =>
      init?.method === 'PATCH' ? { ...CURRENT, ...init.body } : CURRENT,
    );
  });

  it('loads the current values into the form', async () => {
    renderTab();
    expect(await screen.findByLabelText('Dirección')).toHaveValue(CURRENT.address);
    expect(screen.getByLabelText('Horarios')).toHaveValue(CURRENT.hours);
    expect(screen.getByLabelText('WhatsApp')).toHaveValue(CURRENT.whatsapp);
    expect(screen.getByLabelText('Instagram')).toHaveValue(CURRENT.instagram);
    expect(screen.getByLabelText('Email de contacto')).toHaveValue('');
    expect(screen.getByLabelText('Enlace de Google Maps')).toHaveValue(CURRENT.mapsUrl);
    expect(screen.getByLabelText('Email para avisos del staff')).toHaveValue('');
    expect(apiFetch).toHaveBeenCalledWith('/staff/settings/contact');
  });

  it('explains where the data shows up and who receives the staff notices', async () => {
    renderTab();
    await screen.findByLabelText('Dirección');
    expect(screen.getByText('Estos datos también aparecen al pie de los mails a clientes.')).toBeInTheDocument();
    expect(screen.getByText('Recibe los avisos de reservas de Rehab y de Google Calendar.')).toBeInTheDocument();
  });

  it('links the staff notices hint to its field, and keeps it next to the error message', async () => {
    renderTab();
    const field = await screen.findByLabelText('Email para avisos del staff');
    expect(field).toHaveAccessibleDescription('Recibe los avisos de reservas de Rehab y de Google Calendar.');
    expect(screen.getByLabelText('Dirección')).not.toHaveAttribute('aria-describedby');

    await replaceValue('Email para avisos del staff', 'tampoco');
    await save();
    await screen.findByText('Ingresá un email válido.');
    expect(field).toHaveAccessibleDescription('Ingresá un email válido. Recibe los avisos de reservas de Rehab y de Google Calendar.');
  });

  it.each([
    ['a quoted email', '"ana"@move.uy'],
    ['an email with a query', 'ana?cc=x@move.uy'],
    ['an email with an ampersand', 'ana&body=x@move.uy'],
    ['an email with angle brackets', 'Ana <ana@move.uy>'],
  ])('blocks %s before sending it, like the API does', async (_label, value) => {
    renderTab();
    await replaceValue('Email de contacto', value);
    await save();
    expect(await screen.findByText('Ingresá un email válido.')).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });

  it.each(['https:foo.com', 'https:/foo.com'])('blocks the Maps URL %s, which the API rejects', async (value) => {
    renderTab();
    await replaceValue('Enlace de Google Maps', value);
    await save();
    expect(await screen.findByText(/Ingresá un enlace que empiece con https:\/\//)).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });

  it('shows a loading skeleton and then an error state with retry when the load fails', async () => {
    apiFetch.mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'Algo salió mal.'));
    renderTab();
    expect(await screen.findByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Dirección')).toBeNull();
  });

  it('blocks a WhatsApp number without the leading +', async () => {
    renderTab();
    await replaceValue('WhatsApp', '59899140299');
    await save();
    expect(await screen.findByText(/Empezá con \+ y el código de país/)).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });

  it('blocks a WhatsApp number with too few digits', async () => {
    renderTab();
    await replaceValue('WhatsApp', '+5981234');
    await save();
    expect(await screen.findByText(/Empezá con \+ y el código de país/)).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });

  it('blocks an Instagram handle without the @', async () => {
    renderTab();
    await replaceValue('Instagram', 'move_uy');
    await save();
    expect(await screen.findByText(/Empezá con @/)).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });

  it('blocks a Maps URL that is not https', async () => {
    renderTab();
    await replaceValue('Enlace de Google Maps', 'http://maps.example/x');
    await save();
    expect(await screen.findByText(/Ingresá un enlace que empiece con https:\/\//)).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });

  it('blocks malformed emails in both email fields', async () => {
    renderTab();
    await replaceValue('Email de contacto', 'no-es-un-mail');
    await replaceValue('Email para avisos del staff', 'tampoco');
    await save();
    expect(await screen.findAllByText('Ingresá un email válido.')).toHaveLength(2);
    expect(patchCalls()).toHaveLength(0);
  });

  it('blocks an address longer than 200 characters', async () => {
    renderTab();
    const field = await screen.findByLabelText('Dirección');
    await userEvent.clear(field);
    await userEvent.click(field);
    await userEvent.paste('a'.repeat(201));
    await save();
    expect(await screen.findByText('Máximo 200 caracteres.')).toBeInTheDocument();
    expect(patchCalls()).toHaveLength(0);
  });

  it('sends only the changed fields and toasts', async () => {
    const { toast } = await import('sonner');
    renderTab();
    await replaceValue('Email de contacto', 'hola@move.uy');
    await save();
    await vi.waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(apiFetch).toHaveBeenCalledWith('/staff/settings/contact', { method: 'PATCH', body: { email: 'hola@move.uy' } });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith('Contacto guardado.'));
  });

  it('trims the values before comparing and sending them', async () => {
    renderTab();
    await replaceValue('Dirección', '  Calle Nueva 123  ');
    await save();
    await vi.waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(apiFetch).toHaveBeenCalledWith('/staff/settings/contact', { method: 'PATCH', body: { address: 'Calle Nueva 123' } });
  });

  it('clears a field by sending an empty string', async () => {
    renderTab();
    await replaceValue('Instagram', '');
    await save();
    await vi.waitFor(() => expect(patchCalls()).toHaveLength(1));
    expect(apiFetch).toHaveBeenCalledWith('/staff/settings/contact', { method: 'PATCH', body: { instagram: '' } });
  });

  it('does not call the API when nothing changed', async () => {
    const { toast } = await import('sonner');
    renderTab();
    await screen.findByLabelText('Dirección');
    await save();
    await vi.waitFor(() => expect(toast.info).toHaveBeenCalledWith('No hay cambios para guardar.'));
    expect(patchCalls()).toHaveLength(0);
  });

  it('disables the button while saving to prevent a double submit', async () => {
    let release: (value: StaffContactInfoDto) => void = () => undefined;
    apiFetch.mockImplementation(async (_path: string, init?: { method?: string }) =>
      init?.method === 'PATCH' ? new Promise<StaffContactInfoDto>((resolve) => (release = resolve)) : CURRENT,
    );
    renderTab();
    await replaceValue('Email de contacto', 'hola@move.uy');
    await save();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled());
    release({ ...CURRENT, email: 'hola@move.uy' });
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled());
  });

  it('marks the field named by an API validation error with our own copy, never the API text', async () => {
    const { toast } = await import('sonner');
    apiFetch.mockImplementation(async (_path: string, init?: { method?: string }) => {
      if (init?.method === 'PATCH') {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Los datos enviados no son válidos.', [
          { field: 'whatsapp', messages: ['whatsapp must be + followed by 8 to 15 digits'] },
        ]);
      }
      return CURRENT;
    });
    renderTab();
    const field = await replaceValue('WhatsApp', '+598 99 111 222');
    await save();

    const message = await screen.findByText('Revisá este valor.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('aria-describedby', message.id);
    expect(screen.queryByText(/must be/)).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Los datos enviados no son válidos.');
  });
});
