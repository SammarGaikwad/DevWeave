import dotenv from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test' });
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://test_user:test_password@localhost:5432/devweave_test';
  }
} else {
  dotenv.config();
}

const envSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform((val) => {
      const parsed = parseInt(val, 10);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : 5000;
    }),
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
  JENKINS_URL: z.string().default('http://98.70.58.149:8080'),
  JENKINS_USERNAME: z.string().optional().default(''),
  JENKINS_API_TOKEN: z.string().optional().default(''),
  JENKINS_JOB_NAME: z.string().default('DevWeave-CI-CD'),
  DOCKER_RUNNER_TOKEN: z.string().min(32).optional(),
  DOCKER_RUNNER_ID: z.string().min(1).max(100).optional(),
  KUBERNETES_RUNNER_TOKEN: z.string().min(32).optional(),
  KUBERNETES_RUNNER_ID: z.string().min(1).max(100).optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables configuration:');
  console.error(JSON.stringify(_env.error.format(), null, 2));
  throw new Error('Environment configuration validation failed. Process exiting.');
}

export const env = _env.data;
