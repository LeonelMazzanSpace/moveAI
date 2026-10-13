import { registerAs } from '@nestjs/config';

const optional = (value: string | undefined): string | null => (value ? value : null);

export const mercadoPagoConfig = registerAs('mercadoPago', () => {
  const accessToken = optional(process.env.MP_ACCESS_TOKEN);
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  return {
    accessToken,
    webhookSecret: optional(process.env.MP_WEBHOOK_SECRET),
    simulatorEnabled: !accessToken && nodeEnv !== 'production',
  };
});
