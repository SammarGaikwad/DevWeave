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
  });
});
