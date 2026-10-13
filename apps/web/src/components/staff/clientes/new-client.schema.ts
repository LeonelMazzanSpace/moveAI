import { z } from 'zod';

export const newClientSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá el nombre (mínimo 2 caracteres).').max(80, 'El nombre es demasiado largo.'),
  email: z.email('Ingresá un email válido.'),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || (value.length >= 6 && value.length <= 20), 'El teléfono debe tener entre 6 y 20 caracteres.'),
});

export type NewClientValues = z.infer<typeof newClientSchema>;

export interface NewClientPayload {
  name: string;
  email: string;
  phone?: string;
}

export function toNewClientPayload({ name, email, phone }: NewClientValues): NewClientPayload {
  return { name, email, ...(phone && { phone }) };
}
