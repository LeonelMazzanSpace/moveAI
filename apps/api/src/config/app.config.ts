import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
}));
