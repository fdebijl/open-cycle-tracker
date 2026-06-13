import 'dotenv/config';
import { z } from 'zod';

/**
 * Zod-validated environment. Fail fast at boot if anything required is missing
 * or malformed. No secrets live in source — everything comes from the
 * environment (see .env.example).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be a long random string'),
  SERVER_SECRET: z.string().min(16, 'SERVER_SECRET must be a long random string'),
  JWT_EXPIRES_IN: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 14),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    'Invalid environment configuration:\n',
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

export const env = parsed.data;
export const isTest = env.NODE_ENV === 'test';
export const isProd = env.NODE_ENV === 'production';
