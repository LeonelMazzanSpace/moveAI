import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();
vi.mock('@/lib/api/client', () => ({ apiFetch }));

const { NoticesBell } = await import('./notices-bell');

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NoticesBell />
    </QueryClientProvider>,
  );
}

describe('NoticesBell', () => {
  beforeEach(() => { apiFetch.mockReset(); });

  it('shows the dot when there are notices', async () => {
    apiFetch.mockResolvedValue([{ id: 'n1' }]);
    const { container } = renderBell();
    const link = await screen.findByRole('link', { name: 'Avisos (hay avisos nuevos)' });
    expect(link).toHaveAttribute('href', '/perfil#avisos');
    expect(container.querySelector('span.rounded-full')).not.toBeNull();
    expect(apiFetch).toHaveBeenCalledWith('/me/notices');
  });

  it('shows no dot when there are no notices', async () => {
    apiFetch.mockResolvedValue([]);
    const { container } = renderBell();
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(await screen.findByRole('link', { name: 'Avisos' })).toHaveAttribute('href', '/perfil#avisos');
    expect(container.querySelector('span.rounded-full')).toBeNull();
  });

  it('shows no dot when the notices cannot be loaded', async () => {
    apiFetch.mockRejectedValue(new Error('network'));
    const { container } = renderBell();
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: 'Avisos' })).toBeInTheDocument();
    expect(container.querySelector('span.rounded-full')).toBeNull();
  });
});
