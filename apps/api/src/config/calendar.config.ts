import { registerAs } from '@nestjs/config';

const optional = (value: string | undefined): string | null => (value ? value : null);

// D94. CALENDAR_TOKEN_KEY was validated at boot (32 bytes in base64) and is decoded only here, once.
export const calendarConfig = registerAs('calendar', () => {
  const clientId = optional(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = optional(process.env.GOOGLE_CLIENT_SECRET);
  const rawKey = optional(process.env.CALENDAR_TOKEN_KEY);
  const tokenKey = rawKey ? Buffer.from(rawKey, 'base64') : null;
  const apiPublicUrl = process.env.API_PUBLIC_URL ?? 'http://localhost:3001';
  return {
    clientId,
    clientSecret,
    tokenKey,
    redirectUri: `${apiPublicUrl}/api/calendar/oauth/callback`,
    configured: clientId !== null && clientSecret !== null && tokenKey !== null,
  };
});

export type CalendarConfig = ReturnType<typeof calendarConfig>;
