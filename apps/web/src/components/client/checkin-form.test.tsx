import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { CheckinForm } from './checkin-form';

describe('CheckinForm', () => {
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

  it('shows the contract message and stays enabled for another try when sending fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(409, 'CHECKIN_ALREADY_ANSWERED', 'x'));
    render(<CheckinForm firstName="Martina" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Bien' }));
    await userEvent.click(screen.getByRole('radio', { name: 'No' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Siguen igual' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Este check-in ya fue respondido.');
  });
});
