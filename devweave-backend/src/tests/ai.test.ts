import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';

describe('Diagnostic Engine & AI Fallback API Tests', () => {
  const token = generateAccessToken({ sub: 'ai-test-user', role: 'DEVELOPER' });

  describe('GET /api/v1/ai/status', () => {
    it('should truthfully report deterministic rule engine without claiming fake LLM', async () => {
      const res = await request(app)
        .get('/api/v1/ai/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBe('DETERMINISTIC_RULES');
      expect(res.body.data.isLLMConfigured).toBe(false);
      expect(res.body.data.attributionNotice).toContain('No external LLM API key');
      expect(res.body.data.supportedSignatures.length).toBeGreaterThan(5);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/ai/status');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/ai/diagnose', () => {
    it('should diagnose the historical Vitest failure accurately', async () => {
      const logSnippet = `[Install Dependencies] Installing backend dependencies...
[Run Tests, If Configured] Running automated tests...
sh: 1: vitest: not found
[Build Backend] Stage skipped due to earlier failure`;

      const res = await request(app)
        .post('/api/v1/ai/diagnose')
        .set('Authorization', `Bearer ${token}`)
        .send({ logText: logSnippet });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isAIGenerated).toBe(false);
      expect(res.body.data.signature).toBe('RULE_VITEST_NOT_FOUND');
      expect(res.body.data.category).toBe('DEPENDENCY_RESOLUTION');
      expect(res.body.data.recommendedFixes.some((f: { command?: string }) => f.command?.includes('--include=dev'))).toBe(true);
    });

    it('should diagnose TypeScript compilation failure with file details', async () => {
      const logSnippet = `src/pages/Dashboard.tsx(42,5): error TS2322: Type 'number' is not assignable to type 'string'.`;

      const res = await request(app)
        .post('/api/v1/ai/diagnose')
        .set('Authorization', `Bearer ${token}`)
        .send({ logText: logSnippet });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.signature).toBe('RULE_TYPESCRIPT_COMPILATION_ERROR');
      expect(res.body.data.category).toBe('COMPILATION_ERROR');
      expect(res.body.data.rootCause).toContain('Dashboard.tsx');
    });

    it('should diagnose network connection timeout / refused', async () => {
      const logSnippet = `Error: connect ECONNREFUSED 127.0.0.1:8080 at TCPConnectWrap.afterConnect`;

      const resV1 = await request(app)
        .post('/api/v1/ai/diagnose')
        .set('Authorization', `Bearer ${token}`)
        .send({ logText: logSnippet });

      expect(resV1.status).toBe(200);
      expect(resV1.body.data.signature).toBe('RULE_NETWORK_CONNECTION_REFUSED');
      expect(resV1.body.data.category).toBe('NETWORK_CONNECTIVITY');
    });

    it('should diagnose Kubernetes CrashLoopBackOff failure accurately', async () => {
      const logSnippet = `Events:
  Type     Reason     Age                From               Message
  Warning  BackOff    2m (x5 over 4m)    kubelet            Back-off restarting failed container web-app in pod web-app-7d9f784b8c-x9k2p (exit code 137)`;

      const res = await request(app)
        .post('/api/v1/ai/diagnose')
        .set('Authorization', `Bearer ${token}`)
        .send({ logText: logSnippet });

      expect(res.status).toBe(200);
      expect(res.body.data.signature).toBe('RULE_K8S_CRASHLOOP_BACKOFF');
      expect(res.body.data.category).toBe('KUBERNETES');
      expect(res.body.data.severity).toBe('CRITICAL');
      expect(res.body.data.recommendedFixes.some((f: { command?: string }) => f.command?.includes('kubectl logs'))).toBe(true);
    });

    it('should diagnose Kubernetes ImagePullBackOff failure accurately', async () => {
      const logSnippet = `Failed to pull image "myrepo/backend:v1.2.9": rpc error: code = NotFound desc = failed to pull and unpack image: manifest unknown`;

      const res = await request(app)
        .post('/api/v1/ai/diagnose')
        .set('Authorization', `Bearer ${token}`)
        .send({ logText: logSnippet });

      expect(res.status).toBe(200);
      expect(res.body.data.signature).toBe('RULE_K8S_IMAGE_PULL_ERROR');
      expect(res.body.data.category).toBe('KUBERNETES');
    });

    it('should diagnose Docker image build failure accurately', async () => {
      const logSnippet = `Step 7/12 : RUN npm run build
 ---> Running in a1b2c3d4e5f6
ERROR: failed to solve with frontend dockerfile.v0: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1`;

      const res = await request(app)
        .post('/api/v1/ai/diagnose')
        .set('Authorization', `Bearer ${token}`)
        .send({ logText: logSnippet });

      expect(res.status).toBe(200);
      expect(res.body.data.signature).toBe('RULE_DOCKER_BUILD_FAILED');
      expect(res.body.data.category).toBe('DOCKER_CONTAINER');
    });

    it('should reject empty log text with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/ai/diagnose')
        .set('Authorization', `Bearer ${token}`)
        .send({ logText: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/ai/chat', () => {
    it('should reject unauthenticated chat requests with 401', async () => {
      const res = await request(app)
        .post('/api/v1/ai/chat')
        .send({ message: 'Hello AI' });

      expect(res.status).toBe(401);
    });

    it('should reject empty message with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should answer general DevOps query with deterministic rule engine attribution', async () => {
      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Hello, what can you do?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isAIGenerated).toBe(false);
      expect(res.body.data.engineType).toBe('RULE_BASED_DIAGNOSTIC_ENGINE');
      expect(res.body.data.provider).toBe('DETERMINISTIC_RULES');
      expect(res.body.data.message).toContain('DevWeave AI Assistant');
    });

    it('should provide Kubernetes assistance on Kubernetes queries', async () => {
      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'How do I deploy a Kubernetes service?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Kubernetes');
      expect(res.body.data.message).toContain('ClusterIP');
    });

    it('should automatically diagnose error log snippets sent in chat message', async () => {
      const logSnippet = `[Run Tests] Running automated tests...
sh: 1: vitest: not found
[Build Backend] Stage skipped due to earlier failure`;

      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: logSnippet });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.diagnosis).toBeDefined();
      expect(res.body.data.diagnosis.signature).toBe('RULE_VITEST_NOT_FOUND');
      expect(res.body.data.message).toContain('Automated DevOps Diagnosis');
      expect(res.body.data.message).toContain('Missing Vitest Binary');
    });
  });
});
