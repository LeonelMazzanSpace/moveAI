import { registerAs } from '@nestjs/config';
import { parsePort, parseTrustProxyHops } from './env.validation.js';

export const appConfig = registerAs('app', () => ({
  port: parsePort(process.env.PORT ?? '3001'),
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
  apiPublicUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:3001',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  trustProxyHops: parseTrustProxyHops(process.env.TRUST_PROXY_HOPS),
}));
