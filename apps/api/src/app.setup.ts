import { ValidationPipe } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter, validationExceptionFactory } from './common/errors/all-exceptions.filter.js';
import { appConfig } from './config/app.config.js';
import { mountAuth } from './modules/auth/mount-auth.js';

export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  if (config.trustProxyHops > 0) app.set('trust proxy', config.trustProxyHops);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.webUrl, credentials: true });
  // Body parsers go after any raw handlers: Better Auth reads its own body.
  mountAuth(app);
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: validationExceptionFactory }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}
