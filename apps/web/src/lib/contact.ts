import type { ContactInfoDto } from '@/lib/api/types';

export function whatsappUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

export function instagramUrl(handle: string): string | null {
  const name = handle.trim().replace(/^@/, '');
  return name ? `https://www.instagram.com/${name}/` : null;
}

export function mailtoUrl(email: string): string | null {
  const address = email.trim();
  return address ? `mailto:${address}` : null;
}

export function hasContactData(contact: ContactInfoDto): boolean {
  return Object.values(contact).some((value) => typeof value === 'string' && value.trim() !== '');
}
