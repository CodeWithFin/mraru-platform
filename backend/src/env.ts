import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z
    .string()
    .default('postgres://mraru:mraru@localhost:5432/mraru'),

  JWT_SECRET: z.string().min(32).default('dev-only-secret-change-me-please-32bytes'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  JWT_OTP_GRANT_TTL: z.string().default('10m'),

  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
    .default('0'.repeat(64)),

  SMS_PROVIDER: z.enum(['dev', 'tilil']).default('dev'),
  TILIL_BASE_URL: z.string().url().default('https://api.tililtech.com/sms/v3/api'),
  TILIL_API_KEY: z.string().default(''),
  TILIL_SENDER_ID: z.string().default('MRARU'),

  REDIS_URL: z.string().default(''),

  S3_ENDPOINT: z.string().default(''),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_BUCKET: z.string().default('mraru-documents'),
  S3_REGION: z.string().default('us-east-1'),
  S3_USE_SSL: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  UPLOAD_DIR: z.string().default('./uploads'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

export const env = parsed.data;
