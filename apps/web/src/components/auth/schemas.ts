import { z } from 'zod';

const EMAIL_MESSAGE = 'Ingresá un email válido.';
const PASSWORD_MIN_MESSAGE = 'La contraseña debe tener al menos 8 caracteres.';
const PASSWORD_MAX_MESSAGE = 'La contraseña puede tener hasta 128 caracteres.';

const emailField = z.string().trim().pipe(z.email(EMAIL_MESSAGE).max(254, EMAIL_MESSAGE));
const newPasswordField = z.string().min(8, PASSWORD_MIN_MESSAGE).max(128, PASSWORD_MAX_MESSAGE);

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Ingresá tu contraseña.'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá tu nombre (mínimo 2 caracteres).').max(80, 'El nombre es demasiado largo.'),
  email: emailField,
  password: newPasswordField,
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || (value.length >= 6 && value.length <= 20), 'El teléfono debe tener entre 6 y 20 caracteres.'),
});

export const forgotSchema = z.object({ email: emailField });

export const resetSchema = z
  .object({
    password: newPasswordField,
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirm'],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotValues = z.infer<typeof forgotSchema>;
export type ResetValues = z.infer<typeof resetSchema>;
