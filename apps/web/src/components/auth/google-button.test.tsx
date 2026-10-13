import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('next=/planes') }));
const signInSocial = vi.fn();
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { social: signInSocial } } }));

async function loadButton(flag: string | undefined) {
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_ENABLED', flag);
  vi.resetModules();
  const { GoogleButton } = await import('./google-button');
  return GoogleButton;
}

describe('GoogleButton', () => {
  beforeEach(() => { signInSocial.mockReset(); });
  afterEach(() => vi.unstubAllEnvs());

  it('renders nothing unless the flag is exactly "true"', async () => {
    for (const flag of [undefined, 'false', '1']) {
      const GoogleButton = await loadButton(flag);
      const { container, unmount } = render(<GoogleButton />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it('signs in with Google and keeps next in both callback URLs', async () => {
    signInSocial.mockResolvedValue({ data: {}, error: null });
    const GoogleButton = await loadButton('true');
    render(<GoogleButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: `${window.location.origin}/continuar?next=%2Fplanes`,
      errorCallbackURL: `${window.location.origin}/ingresar?next=%2Fplanes`,
    });
  });

  it('shows an error and re-enables the button when Google fails', async () => {
    signInSocial.mockResolvedValue({ data: null, error: { status: 500 } });
    const GoogleButton = await loadButton('true');
    render(<GoogleButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar con Google. Probá de nuevo.');
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled();
  });
});
