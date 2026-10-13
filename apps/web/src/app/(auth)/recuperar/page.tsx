import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { DisplayTitle } from '@/components/move/display-title';
import { Eyebrow } from '@/components/move/eyebrow';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default function RecuperarPage() {
  return (
    <div className="mx-auto max-w-md">
      <div className="flex justify-center">
        <Eyebrow>Acceso</Eyebrow>
      </div>
      <div className="mt-4 text-center">
        <DisplayTitle as="h1">Recuperá tu acceso.</DisplayTitle>
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Ingresá tu email y te enviamos un link para elegir una contraseña nueva.
      </p>
      <div className="mt-8 rounded border border-border bg-card p-7">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/ingresar" className="underline underline-offset-2">
          Volver a ingresar
        </Link>
      </p>
    </div>
  );
}
