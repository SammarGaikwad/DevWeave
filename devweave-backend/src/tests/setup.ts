import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Force NODE_ENV to test
process.env.NODE_ENV = 'test';

// 2. Load .env.test if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// 3. Ensure test environment variables are set with safe test-only values
// Protect against accidental exposure or modification of production Supabase database
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('supabase.co')) {
  process.env.DATABASE_URL = 'postgresql://test_user:test_password@localhost:5432/devweave_test';
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'devweave_test_jwt_secret_key_32chars_long';
}

if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 'devweave_test_jwt_refresh_secret_key_32chars_long';
}

if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
  process.env.INTEGRATION_ENCRYPTION_KEY = 'devweave_test_integration_encryption_key_32bytes_long';
}

if (!process.env.GITHUB_CLIENT_ID) {
  process.env.GITHUB_CLIENT_ID = 'devweave_test_github_client_id';
}

if (!process.env.GITHUB_CLIENT_SECRET) {
  process.env.GITHUB_CLIENT_SECRET = 'devweave_test_github_client_secret';
}

if (!process.env.JENKINS_URL) {
  process.env.JENKINS_URL = 'http://localhost:8080';
}

if (!process.env.JENKINS_JOB_NAME) {
  process.env.JENKINS_JOB_NAME = 'DevWeave-CI-CD';
}

if (!process.env.DOCKER_RUNNER_TOKEN) {
  process.env.DOCKER_RUNNER_TOKEN =
    'devweave_test_docker_runner_token_only_123456';
}

if (!process.env.KUBERNETES_RUNNER_TOKEN) {
  process.env.KUBERNETES_RUNNER_TOKEN =
    'devweave_test_k8s_runner_token_only_123456';
}
