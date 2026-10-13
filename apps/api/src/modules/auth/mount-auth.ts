import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import type { Express } from 'express';
import { BETTER_AUTH } from './auth.constants.js';
import type { BetterAuthInstance } from './better-auth.factory.js';

// Better Auth reads the raw request body, so it must be registered before Nest's body parsers.
export function mountAuth(app: NestExpressApplication): void {
  const auth = app.get<BetterAuthInstance>(BETTER_AUTH);
  const express: Express = app.getHttpAdapter().getInstance();
  express.all('/api/auth/{*splat}', toNodeHandler(auth));
}
