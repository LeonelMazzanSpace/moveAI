'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    const { error } = await authClient.signOut();
    if (error) {
      setPending(false);
      toast.error('No pudimos cerrar tu sesión. Probá de nuevo.');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className={cn(
        'rounded border border-border px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground hover:bg-card disabled:opacity-50',
        className,
      )}
    >
      Salir
    </button>
  );
}
