'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { ErrorState } from '@/components/move/error-state';
import { ApiError } from '@/lib/api/errors';
import { apiFetch } from '@/lib/api/client';
import type { MeDto } from '@/lib/api/types';
import { resolvePostLogin, withNext } from '@/lib/auth/post-login';

function ContinueRedirect() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const { data: me, error, refetch } = useQuery({
    queryKey: ['me', 'post-login'],
    queryFn: () => apiFetch<MeDto>('/me'),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (me) router.replace(resolvePostLogin(me, next));
  }, [me, next, router]);

  if (error instanceof ApiError && error.status === 401) {
    return (
      <div className="space-y-3 text-center text-sm text-muted-foreground">
        <p>Tu sesión no está activa.</p>
        <Link href={withNext('/ingresar', next)} className="inline-flex min-h-8 items-center underline underline-offset-2">
          Ingresar
        </Link>
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <p role="status" className="text-center text-sm text-muted-foreground">
      Un momento, te estamos llevando a tu cuenta…
    </p>
  );
}

export default function ContinuarPage() {
  return (
    <div className="mx-auto max-w-md">
      <Suspense fallback={null}>
        <ContinueRedirect />
      </Suspense>
    </div>
  );
}
