import 'reflect-metadata';
import { plainToInstance, Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBooleanString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export const NodeEnv = {
  Development: 'development',
  Production: 'production',
  Test: 'test',
} as const;

export type NodeEnv = (typeof NodeEnv)[keyof typeof NodeEnv];

// D58: plain digits only; absent or empty is 0 and any other spelling is NaN, which fails validation. appConfig converts
// with this same function, so Express gets exactly the validated number ('50e-1' or '0x2' would convert differently).
export const parseTrustProxyHops = (raw: unknown): number => {
  if (raw === undefined || raw === '') return 0;
  return typeof raw === 'string' && /^[0-5]$/.test(raw) ? Number(raw) : Number.NaN;
};

const hasGoogle = (o: EnvironmentVariables): boolean =>
  o.GOOGLE_CLIENT_ID !== undefined || o.GOOGLE_CLIENT_SECRET !== undefined;
const isProduction = (o: EnvironmentVariables): boolean => o.NODE_ENV === NodeEnv.Production;

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsUrl({ require_tld: false })
  WEB_URL: string;

  @IsUrl({ require_tld: false })
  API_PUBLIC_URL: string;

  @IsString()
  DB_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  DB_USER: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_NAME: string;

  @IsOptional()
  @IsBooleanString()
  DB_SSL?: string;

  @IsString()
  @MinLength(32)
  BETTER_AUTH_SECRET: string;

  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  @ValidateIf(hasGoogle)
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  @ValidateIf(hasGoogle)
  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  @ValidateIf((o: EnvironmentVariables) => isProduction(o) || o.MP_ACCESS_TOKEN !== undefined)
  @IsString()
  MP_ACCESS_TOKEN?: string;

  @ValidateIf((o: EnvironmentVariables) => isProduction(o) || o.MP_ACCESS_TOKEN !== undefined)
  @IsString()
  MP_WEBHOOK_SECRET?: string;

  @ValidateIf((o: EnvironmentVariables) => isProduction(o) || o.BREVO_API_KEY !== undefined)
  @IsString()
  BREVO_API_KEY?: string;

  @ValidateIf((o: EnvironmentVariables) => isProduction(o) || o.BREVO_API_KEY !== undefined)
  @IsEmail()
  BREVO_SENDER_EMAIL?: string;

  @IsOptional()
  @IsString()
  BREVO_SENDER_NAME?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  SCHEDULER_ENABLED?: string;

  // D58: proxies in front of the API whose X-Forwarded-For entry is trusted (2 = ALB + Nginx). Never `true`: the client
  // would choose its own IP and get past the checkout throttler.
  @Transform(({ obj }: TransformFnParams) => parseTrustProxyHops((obj as Record<string, unknown>).TRUST_PROXY_HOPS))
  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY_HOPS: number = 0;
}

// `KEY=` in a .env file counts as an absent variable.
const withoutEmptyValues = (config: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(config).filter(([, value]) => value !== ''));

export const validate = (config: Record<string, unknown>): EnvironmentVariables => {
  const validated = plainToInstance(EnvironmentVariables, withoutEmptyValues(config), {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) throw new Error(errors.toString());

  return validated;
};
