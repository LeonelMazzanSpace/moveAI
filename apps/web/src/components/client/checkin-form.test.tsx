import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RADIO_CLASS } from '@/components/move/radio-styles';
import { ApiError } from '@/lib/api/errors';

const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const { CheckinForm, CheckinPanel } = await import('./checkin-form');

async function answerQuickly() {
  await userEvent.click(screen.getByRole('radio', { name: 'Bien' }));
  await userEvent.click(screen.getByRole('radio', { name: 'No' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Siguen igual' }));
  await userEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
}

const optionCard = (name: string) => {
  const card = screen.getByRole('radio', { name }).closest('label');
  if (!card) throw new Error(`the option ${name} is not inside a card`);
  return card;
};

describe('CheckinForm', () => {
  it('draws every option with the shared radio style', () => {
    render(<CheckinForm firstName="Martina" onSubmit={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(7);
    for (const radio of radios) expect(radio.className).toContain(RADIO_CLASS);
  });

  it('highlights only the chosen option of each question', async () => {
    render(<CheckinForm firstName="Martina" onSubmit={vi.fn()} />);
    expect(optionCard('Bien')).toHaveClass('border-border');

    await userEvent.click(screen.getByRole('radio', { name: 'Bien' }));
    expect(screen.getByRole('radio', { name: 'Bien' })).toBeChecked();
    expect(optionCard('Bien')).toHaveClass('border-foreground');
    expect(optionCard('Bien')).not.toHaveClass('border-border');
    expect(optionCard('Muy bien')).toHaveClass('border-border');

    await userEvent.click(screen.getByText('Muy bien'));
    expect(screen.getByRole('radio', { name: 'Muy bien' })).toBeChecked();
    expect(optionCard('Muy bien')).toHaveClass('border-foreground');
    expect(optionCard('Bien')).toHaveClass('border-border');
    expect(optionCard('No')).toHaveClass('border-border');
  });

  it('requires the pain detail and submits the answers', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CheckinForm firstName="Martina" onSubmit={onSubmit} />);
    expect(screen.getByText('¿Cómo venís, Martina?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Bien' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Sí, leve' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Siguen igual' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(await screen.findByText('Contanos dónde sentís la molestia.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('¿Dónde?'), 'Molestia en hombro izquierdo al hacer press');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(onSubmit).toHaveBeenCalledWith({ feeling: 'good', pain: 'mild', painDetail: 'Molestia en hombro izquierdo al hacer press', goals: 'same' });
  });

  it('sends the optional goals text only when the goals change', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CheckinForm firstName="Martina" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Muy bien' }));
    await userEvent.click(screen.getByRole('radio', { name: 'No' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Quiero ajustarlos' }));
    await userEvent.type(screen.getByLabelText('¿Qué te gustaría cambiar?'), 'Preparar una maratón');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(onSubmit).toHaveBeenCalledWith({ feeling: 'very_good', pain: 'none', goals: 'adjust', goalsDetail: 'Preparar una maratón' });
  });

  it('asks for every answer before sending', async () => {
    const onSubmit = vi.fn();
    render(<CheckinForm firstName="Martina" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(await screen.findByText('Elegí cómo te sentís.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the error message and enables the button again when sending fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(502, 'NETWORK_ERROR', 'x'));
    render(<CheckinForm firstName="Martina" onSubmit={onSubmit} />);
    await answerQuickly();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar con MOVE. Probá de nuevo.');
    expect(screen.getByRole('button', { name: 'Enviar respuesta' })).toBeEnabled();
  });

  it('keeps the button disabled once the answers were sent', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CheckinForm firstName="Martina" onSubmit={onSubmit} />);
    await answerQuickly();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar respuesta' })).toBeDisabled());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

const PENDING = { checkin: { id: 'k1', period: '2026-10', firstName: 'Martina' } };

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <CheckinPanel />
    </QueryClientProvider>,
  );
  return { invalidate };
}

describe('CheckinPanel', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    toastError.mockReset();
  });

  it('tells the client when there is no pending check-in', async () => {
    apiFetch.mockResolvedValue({ checkin: null });
    renderPanel();
    expect(await screen.findByText('No tenés check-ins pendientes.')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/me/checkins/pending');
  });

  it('sends the answers, thanks the client and refreshes the notices', async () => {
    apiFetch.mockImplementation((path: string) =>
      Promise.resolve(path === '/me/checkins/pending' ? PENDING : { flag: 'ok' }),
    );
    const { invalidate } = renderPanel();
    expect(await screen.findByText('¿Cómo venís, Martina?')).toBeInTheDocument();
    await answerQuickly();
    expect(await screen.findByText('¡Gracias! El equipo de MOVE revisa tus respuestas.')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/me/checkins/k1', { method: 'POST', body: { feeling: 'good', pain: 'none', goals: 'same' } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['me', 'notices'] });
    expect(screen.queryByRole('button', { name: 'Enviar respuesta' })).not.toBeInTheDocument();
  });

  it('clears the pending check-in with a toast when it was already answered', async () => {
    apiFetch.mockImplementation((path: string) =>
      path === '/me/checkins/pending' ? Promise.resolve(PENDING) : Promise.reject(new ApiError(409, 'CHECKIN_ALREADY_ANSWERED', 'x')),
    );
    renderPanel();
    await screen.findByText('¿Cómo venís, Martina?');
    await answerQuickly();
    expect(await screen.findByText('No tenés check-ins pendientes.')).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith('Este check-in ya fue respondido.');
  });
});
