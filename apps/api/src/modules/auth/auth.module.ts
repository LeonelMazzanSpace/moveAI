import { Inject, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { APP_GUARD, ModuleRef } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import pg from 'pg';
import { appConfig } from '../../config/app.config.js';
import { authConfig } from '../../config/auth.config.js';
import { databaseConfig, type DatabaseConfig } from '../../config/database.config.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { UsersModule } from '../users/users.module.js';
import { BETTER_AUTH } from './auth.constants.js';
import { createBetterAuth } from './better-auth.factory.js';
import { AuthAccount } from './entities/auth-account.entity.js';
import { AuthVerification } from './entities/auth-verification.entity.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AuthService } from './services/auth.service.js';

const AUTH_PG_POOL = Symbol('AUTH_PG_POOL');

@Module({
  imports: [UsersModule, NotificationsModule, TypeOrmModule.forFeature([AuthAccount, AuthVerification])],
  providers: [
    {
      provide: AUTH_PG_POOL,
      inject: [databaseConfig.KEY],
      useFactory: (db: DatabaseConfig) => {
        const pool = new pg.Pool({
          host: db.host, port: db.port, user: db.username, password: db.password, database: db.name, ssl: db.ssl,
        });
        // An idle client error must not crash the process; the next query reconnects.
        pool.on('error', () => new Logger(AuthModule.name).warn('auth pool idle client error'));
        return pool;
      },
    },
    {
      provide: BETTER_AUTH,
      inject: [AUTH_PG_POOL, authConfig.KEY, appConfig.KEY, ModuleRef],
      useFactory: (
        pool: pg.Pool, auth: ConfigType<typeof authConfig>, app: ConfigType<typeof appConfig>, moduleRef: ModuleRef,
      ) =>
        createBetterAuth({
          pool,
          secret: auth.secret,
          baseURL: app.apiPublicUrl,
          webUrl: app.webUrl,
          cookieDomain: auth.cookieDomain,
          google: auth.google,
          isProduction: app.nodeEnv === 'production',
          // Resolved lazily: AuthService itself depends on BETTER_AUTH.
          sendResetPassword: (data) => moduleRef.get(AuthService).sendPasswordEmail(data),
        }),
    },
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, BETTER_AUTH],
})
export class AuthModule implements OnModuleDestroy {
  constructor(@Inject(AUTH_PG_POOL) private readonly pool: pg.Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
