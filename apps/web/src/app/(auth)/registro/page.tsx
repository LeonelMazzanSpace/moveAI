import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthTabs } from '@/components/auth/auth-tabs';
import { ProfilesInfo } from '@/components/auth/profiles-info';
import { RegisterForm } from '@/components/auth/register-form';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';

export const metadata: Metadata = { title: 'Crear cuenta' };

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
        <Suspense fallback={null}>
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
