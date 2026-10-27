import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';
import { env } from '../config/env.js';

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

    it('should reject oversized message exceeding 8000 characters with 400 Bad Request', async () => {
      const hugeMessage = 'A'.repeat(8001);
      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: hugeMessage });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should answer general DevOps query with truthful unconfigured provider status when no key is set', async () => {
      const res = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'Hello, what can you do?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isAIGenerated).toBe(false);
      expect(res.body.data.isProviderConfigured).toBe(false);
      expect(res.body.data.engineType).toBe('RULE_BASED_DIAGNOSTIC_ENGINE');
      expect(res.body.data.message).toContain('Provider Configuration Required');
      expect(res.body.data.message).toContain('OPENAI_API_KEY');
    });

    it('should automatically diagnose error log snippets sent in chat message without LLM configured', async () => {
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

    describe('Provider Integration (Mocked LLM)', () => {
      const originalFetch = globalThis.fetch;
      const originalOpenAIKey = env.OPENAI_API_KEY;
      const originalGeminiKey = env.GEMINI_API_KEY;

      afterEach(() => {
        globalThis.fetch = originalFetch;
        (env as any).OPENAI_API_KEY = originalOpenAIKey;
        (env as any).GEMINI_API_KEY = originalGeminiKey;
      });

      it('should generate real AI response when OpenAI is configured and reachable', async () => {
        (env as any).OPENAI_API_KEY = 'sk-mock-valid-openai-key';

        globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
          expect(url.toString()).toContain('api.openai.com/v1/chat/completions');
          const body = JSON.parse(init?.body as string);
          expect(body.model).toBe(env.OPENAI_MODEL);
          expect(body.messages[0].role).toBe('system');
          expect(body.messages[0].content).toContain('DevWeave AI Assistant');
          expect(body.messages[1].role).toBe('user');
          expect(body.messages[1].content).toBe('How do I write a Kubernetes Service manifest?');

          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: 'To create a Kubernetes Service, define a `kind: Service` manifest targeting your pods with selectors.',
                  },
                },
              ],
            }),
          } as Response;
        }) as typeof fetch;

        const res = await request(app)
          .post('/api/v1/ai/chat')
          .set('Authorization', `Bearer ${token}`)
          .send({
            message: 'How do I write a Kubernetes Service manifest?',
            history: [],
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isAIGenerated).toBe(true);
        expect(res.body.data.provider).toBe('OPENAI');
        expect(res.body.data.isProviderConfigured).toBe(true);
        expect(res.body.data.message).toContain('To create a Kubernetes Service');
      });

      it('should handle OpenAI HTTP 401 invalid API key gracefully without exposing secrets', async () => {
        (env as any).OPENAI_API_KEY = 'sk-invalid-key';

        globalThis.fetch = (async () => ({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({
            error: { message: 'Incorrect API key provided' },
          }),
        })) as unknown as typeof fetch;

        const res = await request(app)
          .post('/api/v1/ai/chat')
          .set('Authorization', `Bearer ${token}`)
          .send({ message: 'Explain my dockerfile' });

        expect(res.status).toBe(200);
        expect(res.body.data.isProviderError).toBe(true);
        expect(res.body.data.isAIGenerated).toBe(false);
        expect(res.body.data.message).toContain('OpenAI Authentication Error');
        expect(res.body.data.message).not.toContain('sk-invalid-key');
      });

      it('should handle OpenAI HTTP 429 quota/rate limit error gracefully', async () => {
        (env as any).OPENAI_API_KEY = 'sk-mock-key';

        globalThis.fetch = (async () => ({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({
            error: { message: 'You exceeded your current quota' },
          }),
        })) as unknown as typeof fetch;

        const res = await request(app)
          .post('/api/v1/ai/chat')
          .set('Authorization', `Bearer ${token}`)
          .send({ message: 'Help me optimize node memory' });

        expect(res.status).toBe(200);
        expect(res.body.data.isProviderError).toBe(true);
        expect(res.body.data.message).toContain('OpenAI Rate Limit / Quota Exceeded');
      });

      it('should handle provider request timeout gracefully', async () => {
        (env as any).OPENAI_API_KEY = 'sk-mock-key';

        globalThis.fetch = (async () => {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }) as unknown as typeof fetch;

        const res = await request(app)
          .post('/api/v1/ai/chat')
          .set('Authorization', `Bearer ${token}`)
          .send({ message: 'Summarize deployment logs' });

        expect(res.status).toBe(200);
        expect(res.body.data.isProviderError).toBe(true);
        expect(res.body.data.message).toContain('OpenAI Request Timeout');
      });

      it('should generate real AI response when Gemini is configured and OpenAI is absent', async () => {
        (env as any).OPENAI_API_KEY = undefined;
        (env as any).GEMINI_API_KEY = 'AIzaSyMockKey';

        globalThis.fetch = (async (url: string | URL | Request) => {
          expect(url.toString()).toContain('generativelanguage.googleapis.com');
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [{ text: 'Gemini Copilot: Here is the optimal Dockerfile for your React app.' }],
                  },
                },
              ],
            }),
          } as Response;
        }) as typeof fetch;

        const res = await request(app)
          .post('/api/v1/ai/chat')
          .set('Authorization', `Bearer ${token}`)
          .send({ message: 'How do I build a minimal React image?' });

        expect(res.status).toBe(200);
        expect(res.body.data.isAIGenerated).toBe(true);
        expect(res.body.data.provider).toBe('GEMINI');
        expect(res.body.data.message).toContain('Gemini Copilot');
      });
    });
  });
});
