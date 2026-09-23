import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';
import { Role } from '../generated/prisma/client.js';

describe('Jenkins CI/CD Integration API Tests', () => {
  const dummyUserId = '00000000-0000-0000-0000-000000000001';
  const testToken = generateAccessToken({ sub: dummyUserId, role: Role.DEVELOPER });

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('POST /api/v1/jenkins/build', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).post('/api/v1/jenkins/build');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Authentication required');
    });

    it('should trigger Jenkins build successfully when authenticated', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/crumbIssuer/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ crumbRequestField: 'Jenkins-Crumb', crumb: 'test-crumb-value' }),
          } as Response;
        }
        if (url.includes('/build')) {
          return {
            ok: true,
            status: 201,
            statusText: 'Created',
            headers: new Headers({
              location: 'http://98.70.58.149:8080/queue/item/42/',
            }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const res = await request(app)
        .post('/api/v1/jenkins/build')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.queueItemId).toBe(42);
      expect(res.body.data.queueItemUrl).toBe('http://98.70.58.149:8080/queue/item/42/');
      expect(res.body.data.buildUrl).toContain('DevWeave-CI-CD');
    });

    it('should return 502 Bad Gateway if Jenkins server fails to trigger build', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as Response;
      });

      const res = await request(app)
        .post('/api/v1/jenkins/build')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Failed to trigger Jenkins build');
    });
  });

  describe('GET /api/v1/jenkins/build/:id', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/jenkins/build/9');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-numeric build ID with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/jenkins/build/invalid-id')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid build ID');
    });

    it('should reject negative build ID with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/jenkins/build/-5')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid build ID');
    });

    it('should return build status details for valid build ID', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/9/api/json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              number: 9,
              url: 'http://98.70.58.149:8080/job/DevWeave-CI-CD/9/',
              timestamp: 1727100000000,
              duration: 42000,
              result: 'SUCCESS',
              building: false,
            }),
          } as Response;
        }
        if (url.includes('/wfapi/describe')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              stages: [
                { id: '1', name: 'Checkout', status: 'SUCCESS', durationMillis: 2000 },
                { id: '2', name: 'Install dependencies', status: 'SUCCESS', durationMillis: 15000 },
                { id: '3', name: 'Frontend build', status: 'SUCCESS', durationMillis: 15000 },
                { id: '4', name: 'Backend build', status: 'SUCCESS', durationMillis: 10000 },
              ],
            }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      });

      const res = await request(app)
        .get('/api/v1/jenkins/build/9')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.number).toBe(9);
      expect(res.body.data.status).toBe('SUCCESS');
      expect(res.body.data.result).toBe('SUCCESS');
      expect(res.body.data.stages.length).toBe(4);
    });

    it('should handle non-existent build ID with 404 Not Found', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/99999/api/json')) {
          return {
            ok: false,
            status: 404,
            statusText: 'Not Found',
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const res = await request(app)
        .get('/api/v1/jenkins/build/99999')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Jenkins build #99999 not found');
    });

    it('should handle building state correctly as status BUILDING', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/10/api/json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              number: 10,
              url: 'http://98.70.58.149:8080/job/DevWeave-CI-CD/10/',
              timestamp: 1727100000000,
              duration: 5000,
              result: null,
              building: true,
            }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      });

      const res = await request(app)
        .get('/api/v1/jenkins/build/10')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('BUILDING');
      expect(res.body.data.result).toBeNull();
    });
  });
});
