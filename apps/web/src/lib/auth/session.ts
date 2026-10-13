import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverApiFetchOrNull } from '@/lib/api/server';
import type { MeDto, Role } from '@/lib/api/types';
import { safeNextPath } from './safe-next';

const HOME_BY_ROLE: Record<Role, string> = { client: '/perfil', staff: '/staff' };
const PATH_HEADER = 'x-move-path';

export async function getCurrentUser(): Promise<MeDto | null> {
  return serverApiFetchOrNull<MeDto>('/me');
}

async function requestedPath(role: Role, areaRoot: string): Promise<string> {
  const path = (await headers()).get(PATH_HEADER);
  return safeNextPath(path, role) ?? areaRoot;
}

export async function requireRole(role: Role, currentPath: string): Promise<MeDto> {
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(await requestedPath(role, currentPath))}`);
  if (user.role !== role) redirect(HOME_BY_ROLE[user.role]);
  return user;
}
