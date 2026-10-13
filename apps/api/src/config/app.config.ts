import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
  apiPublicUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:3001',
  nodeEnv: process.env.NODE_ENV ?? 'development',
}));
