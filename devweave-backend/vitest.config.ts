import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['dist/**', 'node_modules/**'],
    setupFiles: ['./src/tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test_user:test_password@localhost:5432/devweave_test',
      JWT_SECRET: 'devweave_test_jwt_secret_key_32chars_long',
      JWT_REFRESH_SECRET: 'devweave_test_jwt_refresh_secret_key_32chars_long',
      INTEGRATION_ENCRYPTION_KEY: 'devweave_test_integration_encryption_key_32bytes_long',
      GITHUB_CLIENT_ID: 'devweave_test_github_client_id',
      GITHUB_CLIENT_SECRET: 'devweave_test_github_client_secret',
      JENKINS_URL: 'http://localhost:8080',
      JENKINS_JOB_NAME: 'DevWeave-CI-CD',
    },
  },
});
