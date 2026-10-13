import { z } from 'zod';

export const guestSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá tu nombre (mínimo 2 caracteres).').max(80, 'El nombre es demasiado largo.'),
  email: z.email('Ingresá un email válido.'),
  phone: z.string().trim().min(6, 'Ingresá un teléfono válido.').max(20, 'Ingresá un teléfono válido.'),
});

export type GuestValues = z.infer<typeof guestSchema>;
