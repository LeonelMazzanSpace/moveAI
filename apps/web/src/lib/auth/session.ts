import { redirect } from 'next/navigation';
import { serverApiFetchOrNull } from '@/lib/api/server';
import type { MeDto, Role } from '@/lib/api/types';

const HOME_BY_ROLE: Record<Role, string> = { client: '/perfil', staff: '/staff' };

export async function getCurrentUser(): Promise<MeDto | null> {
  return serverApiFetchOrNull<MeDto>('/me');
}

export async function requireRole(role: Role, currentPath: string): Promise<MeDto> {
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(currentPath)}`);
  if (user.role !== role) redirect(HOME_BY_ROLE[user.role]);
  return user;
}
