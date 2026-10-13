import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AvailabilityDayDto } from '@/lib/api/types';
import { WeekSelector } from './week-selector';

const availability: AvailabilityDayDto[] = [
  { date: '2026-10-12', available: 3 },
  { date: '2026-10-13', available: 0 },
  { date: '2026-10-14', available: 5 },
  { date: '2026-10-15', available: 5 },
  { date: '2026-10-16', available: 5 },
  { date: '2026-10-17', available: 5 },
  { date: '2026-10-18', available: 0 },
];

const baseProps = {
  weekStart: '2026-10-12',
  availability,
  value: null,
  onChange: vi.fn(),
  onPrevWeek: vi.fn(),
  onNextWeek: vi.fn(),
  minDate: '2026-10-12',
  maxDate: '2026-10-26',
};

describe('WeekSelector', () => {
  it('renders seven days from Monday and disables days without availability', async () => {
    const onChange = vi.fn();
    render(<WeekSelector {...baseProps} onChange={onChange} />);

    for (const label of ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '13' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '18' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '14' }));
    expect(onChange).toHaveBeenCalledWith('2026-10-14');
  });

  it('disables days outside the bookable range and the week navigation at its limits', () => {
    render(<WeekSelector {...baseProps} minDate="2026-10-14" maxDate="2026-10-18" />);
    expect(screen.getByRole('button', { name: '12' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Semana siguiente' })).toBeDisabled();
  });

  it('moves between weeks', async () => {
    const onNextWeek = vi.fn();
    render(<WeekSelector {...baseProps} onNextWeek={onNextWeek} />);
    await userEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    expect(onNextWeek).toHaveBeenCalledTimes(1);
  });
});
