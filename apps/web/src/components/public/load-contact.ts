import { unstable_rethrow } from 'next/navigation';
import { serverApiFetch } from '@/lib/api/server';
import type { ContactInfoDto } from '@/lib/api/types';

/** The API promises strings; a missing or null field becomes `''` so the footer never breaks on a partial answer. */
function withStringFields(payload: unknown): ContactInfoDto | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record: Record<string, unknown> = { ...payload };
  const text = (name: keyof ContactInfoDto): string => {
    const value = record[name];
    return typeof value === 'string' ? value : '';
  };
  return {
    address: text('address'),
    hours: text('hours'),
    whatsapp: text('whatsapp'),
    instagram: text('instagram'),
    email: text('email'),
    mapsUrl: text('mapsUrl'),
  };
}

export async function loadContact(): Promise<ContactInfoDto | null> {
  try {
    return withStringFields(await serverApiFetch<unknown>('/settings/contact'));
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
