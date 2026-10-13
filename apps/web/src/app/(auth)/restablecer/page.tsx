import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';

export const metadata: Metadata = { title: 'Restablecer contraseña' };

export default function RestablecerPage() {
  return (
    <div className="mx-auto max-w-md">
      <div className="flex justify-center">
        <Eyebrow>Acceso</Eyebrow>
      </div>
      <div className="mt-4 text-center">
        <DisplayTitle as="h1">Nueva contraseña.</DisplayTitle>
      </div>
      <div className="mt-8 rounded border border-border bg-card p-7">
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
