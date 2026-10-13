import { registerAs } from '@nestjs/config';

export interface BrevoConfig {
  apiKey: string | null;
  senderEmail: string | null;
  senderName: string;
  dryRun: boolean;
}

export const brevoConfig = registerAs('brevo', (): BrevoConfig => {
  const apiKey = process.env.BREVO_API_KEY || null;
  return {
    apiKey,
    senderEmail: process.env.BREVO_SENDER_EMAIL || null,
    senderName: process.env.BREVO_SENDER_NAME || 'MOVE',
    dryRun: !apiKey,
  };
});
