import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthTabs } from '@/components/auth/auth-tabs';
import { ProfilesInfo } from '@/components/auth/profiles-info';
import { RegisterForm } from '@/components/auth/register-form';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Crear cuenta' };

/** Same size as the tabs and the form card, so the page does not jump when they hydrate. */
function RegisterSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="mt-10 h-11 rounded" />
      <div className="mt-6 space-y-5 rounded border border-border bg-card p-7">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[66px] rounded" />
        ))}
        <Skeleton className="h-9 rounded" />
      </div>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <>
      <div className="mx-auto max-w-md">
        <div className="flex justify-center">
          <Eyebrow>Acceso</Eyebrow>
        </div>
        <div className="mt-4 text-center">
          <DisplayTitle as="h1">Sumate a MOVE.</DisplayTitle>
        </div>
        <Suspense fallback={<RegisterSkeleton />}>
          <AuthTabs active="register" />
          <RegisterForm />
        </Suspense>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Primera vez en MOVE? Podés reservar Rehab o Recovery sin ser alumno — tu cuenta se crea durante el proceso.
        </p>
      </div>
      <ProfilesInfo />
    </>
  );
}
