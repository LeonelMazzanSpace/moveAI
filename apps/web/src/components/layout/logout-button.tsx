'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { moveButton } from '@/components/move/button-styles';
import { authClient } from '@/lib/auth-client';

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
      className={moveButton({ variant: 'outline', className })}
    >
      Salir
    </button>
  );
}
