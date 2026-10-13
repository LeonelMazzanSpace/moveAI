import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import type { Express, NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '../../common/errors/error-codes.js';
import { BETTER_AUTH } from './auth.constants.js';
import type { BetterAuthInstance } from './better-auth.factory.js';

// Auth bodies are small JSON objects; Nest's body-parser limit does not apply to this raw handler.
const MAX_AUTH_BODY_BYTES = 64 * 1024;

const rejectLargeBodies = (req: Request, res: Response, next: NextFunction): void => {
  if (Number(req.headers['content-length'] ?? 0) <= MAX_AUTH_BODY_BYTES) return next();
  res.status(413).json({ statusCode: 413, code: 'VALIDATION_FAILED', message: ERROR_CODES.VALIDATION_FAILED.message });
};

// Better Auth reads the raw request body, so it must be registered before Nest's body parsers.
export function mountAuth(app: NestExpressApplication): void {
  const auth = app.get<BetterAuthInstance>(BETTER_AUTH);
  const express: Express = app.getHttpAdapter().getInstance();
  express.all('/api/auth/{*splat}', rejectLargeBodies, toNodeHandler(auth));
}
