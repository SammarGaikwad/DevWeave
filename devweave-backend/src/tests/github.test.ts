import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { verifyState, buildAuthorizationUrl } from '../services/githubService.js';
import { generateAccessToken } from '../utils/jwt.js';
import { Role } from '../generated/prisma/client.js';

describe('GitHub Integration API & Security Tests', () => {
  const dummyUserId = '00000000-0000-0000-0000-000000000001';
  const testToken = generateAccessToken({ sub: dummyUserId, role: Role.DEVELOPER });

  describe('OAuth State Security', () => {
    it('should generate a valid signed OAuth state and extract userId', () => {
      const url = buildAuthorizationUrl(dummyUserId);
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=');

      const urlObj = new URL(url);
      const state = urlObj.searchParams.get('state');
      expect(state).toBeDefined();

      const extractedUser = verifyState(state!);
      expect(extractedUser).toBe(dummyUserId);
    });

    it('should reject tampered or invalid state signatures', () => {
      const tamperedState = `${dummyUserId}:nonce:badsignature`;
      expect(() => verifyState(tamperedState)).toThrow();
    });
  });

  describe('GET /api/v1/integrations/github/connect', () => {
    it('should require authentication (401)', async () => {
      const res = await request(app).get('/api/v1/integrations/github/connect');
      expect(res.status).toBe(401);
    });

    it('should return OAuth authorization URL for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/integrations/github/connect')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toContain('github.com/login/oauth/authorize');
    });
  });

  describe('GET /api/v1/integrations/github/status', () => {
    it('should return connected: false by default for unconnected account', async () => {
      const res = await request(app)
        .get('/api/v1/integrations/github/status')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connected).toBe(false);
    });
  });

  describe('GET /api/v1/integrations/github/repositories', () => {
    it('should return 409 Conflict when requesting repos for unconnected GitHub account', async () => {
      const res = await request(app)
        .get('/api/v1/integrations/github/repositories')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not connected');
    });
  });
});
