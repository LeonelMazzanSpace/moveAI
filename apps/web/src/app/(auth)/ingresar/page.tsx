import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthTabs } from '@/components/auth/auth-tabs';
import { LoginForm } from '@/components/auth/login-form';
import { ProfilesInfo } from '@/components/auth/profiles-info';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';

export const metadata: Metadata = { title: 'Ingresar' };

export default function IngresarPage() {
  return (
    <>
      <div className="mx-auto max-w-md">
        <div className="flex justify-center">
          <Eyebrow>Acceso</Eyebrow>
        </div>
        <div className="mt-4 text-center">
          <DisplayTitle as="h1">Entrá a MOVE.</DisplayTitle>
        </div>
        <Suspense fallback={null}>
          <AuthTabs active="login" />
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Primera vez en MOVE? Podés reservar Rehab o Recovery sin ser alumno — tu cuenta se crea durante el proceso.
        </p>
      </div>
      <ProfilesInfo />
    </>
  );
}
