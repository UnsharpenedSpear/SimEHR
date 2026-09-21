import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  MONGO_URI: z.string().default('mongodb://localhost:27017/ehr?replicaSet=rs0&directConnection=true'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  FIELD_ENCRYPTION_KEY: z.string().length(64, 'FIELD_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)'),
  BLIND_INDEX_SALT: z.string().length(64, 'BLIND_INDEX_SALT must be a 64-char hex string (32 bytes)'),

  MFA_ISSUER: z.string().default('SimulatedEHR'),
  COOKIE_SECURE: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(result.error.format(), null, 2));
    if (process.env.NODE_ENV === 'test') {
      // Return safe defaults in test mode if some keys are omitted
      return {
        NODE_ENV: 'test',
        PORT: 5001,
        API_PREFIX: '/api/v1',
        CORS_ORIGIN: 'http://localhost:3000',
        MONGO_URI: 'mongodb://localhost:27017/ehr-test',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: 'test-jwt-access-secret-32-chars-long-minimum-size!!',
        JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-32-chars-long-minimum-size!!',
        FIELD_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        BLIND_INDEX_SALT: '9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        MFA_ISSUER: 'SimulatedEHRTest',
        COOKIE_SECURE: false,
        LOG_LEVEL: 'error',
      };
    }
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
