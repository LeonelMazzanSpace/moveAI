import { registerAs } from '@nestjs/config';

const optional = (value: string | undefined): string | null => (value ? value : null);

export const authConfig = registerAs('auth', () => {
  const clientId = optional(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = optional(process.env.GOOGLE_CLIENT_SECRET);
  return {
    secret: process.env.BETTER_AUTH_SECRET ?? '',
    cookieDomain: optional(process.env.COOKIE_DOMAIN),
    google: clientId && clientSecret ? { clientId, clientSecret } : null,
  };
});
