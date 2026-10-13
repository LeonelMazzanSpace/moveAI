import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';

export type TestAgent = ReturnType<typeof request.agent>;

// Better Auth checks the Origin header against `trustedOrigins` (= WEB_URL).
export const TEST_ORIGIN = process.env.WEB_URL ?? 'http://localhost:3000';

const DEFAULT_PASSWORD = 'Secreto123!';

export async function signUp(
  app: INestApplication,
  input: { name?: string; email?: string; password?: string } = {},
): Promise<{ agent: TestAgent; userId: string; email: string }> {
  const agent = request.agent(app.getHttpServer());
  const email = input.email ?? `user-${randomUUID()}@test.move`;
  const res = await agent
    .post('/api/auth/sign-up/email')
    .set('Origin', TEST_ORIGIN)
    .send({ name: input.name ?? 'Usuario Test', email, password: input.password ?? DEFAULT_PASSWORD })
    .expect(200);
  const body = res.body as { user: { id: string; email: string } };
  return { agent, userId: body.user.id, email: body.user.email };
}

export const signUpClient = (app: INestApplication) => signUp(app);

export async function signUpStaff(app: INestApplication, dataSource: DataSource) {
  const result = await signUp(app);
  await dataSource.query(`UPDATE users SET role = 'staff' WHERE id = $1`, [result.userId]);
  return result;
}
