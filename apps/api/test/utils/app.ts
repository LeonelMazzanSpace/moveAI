import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

export interface TestApp { app: NestExpressApplication; dataSource: DataSource }

// Specs that start more than 10 checkouts a minute (D53) raise the throttler limit instead of disabling it.
export const raisedCheckoutLimit = [{ ttl: 60_000, limit: 1_000 }];

export async function createTestApp(opts: { raiseCheckoutLimit?: boolean } = {}): Promise<TestApp> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (opts.raiseCheckoutLimit) builder.overrideProvider(getOptionsToken()).useValue(raisedCheckoutLimit);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  await app.init();
  return { app, dataSource: app.get(DataSource) };
}
