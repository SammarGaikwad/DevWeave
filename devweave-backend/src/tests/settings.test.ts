import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';

describe('Settings & Integration Status API Tests', () => {
  const token = generateAccessToken({ sub: 'settings-test-user', role: 'DEVELOPER' });

  describe('GET /api/v1/settings/overview', () => {
    it('should return settings overview without leaking plain secret keys', async () => {
      const res = await request(app)
        .get('/api/v1/settings/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      // Check User details
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.role).toBe('DEVELOPER');

      // Check Integrations (GitHub, Jenkins, Database)
      const { github, jenkins, database } = res.body.data.integrations;
      expect(github).toBeDefined();
      expect(typeof github.connected).toBe('boolean');
      expect(github.clientIdMasked).toContain('••••');

      expect(jenkins).toBeDefined();
      expect(jenkins.url).toBeDefined();
      expect(jenkins.tokenMasked).toContain('••••');
      // Ensure plain token is never returned
      expect(jenkins.tokenMasked).not.toBe('115c3e5158c964b31c306c4b21d7d7f001');

      expect(database).toBeDefined();
      expect(database.connectionStringMasked).toContain('••••');

      // Check Environment
      expect(res.body.data.environment).toBeDefined();
      expect(res.body.data.environment.port).toBeDefined();
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/settings/overview');
      expect(res.status).toBe(401);
    });
  });
});
