'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { withNext } from '@/lib/auth/post-login';

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export function GoogleButton() {
  const next = useSearchParams().get('next');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!GOOGLE_ENABLED) return null;

  async function handleClick() {
    setPending(true);
    setFailed(false);
    try {
      const { error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}${withNext('/continuar', next)}`,
      });
      if (error) throw new Error('google-sign-in-failed');
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div>
      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">o continuá con</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={handleClick}
        className="h-auto w-full gap-3 border-border bg-soft py-2.5 text-sm font-medium hover:bg-card"
      >
        <GoogleLogo />
        Continuar con Google
      </Button>
      {failed ? (
        <p role="alert" className="mt-3 text-center text-xs text-danger">
          No pudimos conectar con Google. Probá de nuevo.
        </p>
      ) : null}
    </div>
  );
}
