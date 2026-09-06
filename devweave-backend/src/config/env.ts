import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('8080').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL environment variable is required'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().default('devweave_jwt_secret_key_development_only'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().default('devweave_jwt_refresh_secret_key_development_only'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  GITHUB_CLIENT_ID: z.string().default('development_github_client_id'),
  GITHUB_CLIENT_SECRET: z.string().default('development_github_client_secret'),
  GITHUB_CALLBACK_URL: z
    .string()
    .default('http://localhost:8080/api/v1/integrations/github/callback'),
  INTEGRATION_ENCRYPTION_KEY: z
    .string()
    .default('devweave_integration_encryption_key_32bytes_long_secret'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables configuration:');
  console.error(JSON.stringify(_env.error.format(), null, 2));
  throw new Error('Environment configuration validation failed. Process exiting.');
}

export const env = _env.data;
