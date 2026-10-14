import { unstable_rethrow } from 'next/navigation';
import { serverApiFetch } from '@/lib/api/server';
import type { ContactInfoDto } from '@/lib/api/types';

export async function loadContact(): Promise<ContactInfoDto | null> {
  try {
    return await serverApiFetch<ContactInfoDto>('/settings/contact');
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
