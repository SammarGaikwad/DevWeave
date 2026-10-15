import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';

describe('Docker Management API Tests', () => {
  const token = generateAccessToken({ sub: 'docker-test-user', role: 'DEVELOPER' });

  describe('GET /api/v1/docker/status', () => {
    it('should return real docker status without throwing', async () => {
      const res = await request(app)
        .get('/api/v1/docker/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.installed).toBe('boolean');
      expect(typeof res.body.data.daemonRunning).toBe('boolean');
      expect(['CONNECTED', 'DAEMON_OFFLINE', 'NOT_INSTALLED']).toContain(res.body.data.status);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/docker/status');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/docker/templates', () => {
    it('should list all predefined Dockerfile templates', async () => {
      const res = await request(app)
        .get('/api/v1/docker/templates')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);

      const nodeTemplate = res.body.data.find((t: { id: string }) => t.id === 'nodejs-express');
      expect(nodeTemplate).toBeDefined();
      expect(nodeTemplate.category).toBe('Backend');
      expect(nodeTemplate.bestPractices.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/docker/templates/:id', () => {
    it('should retrieve specific template content', async () => {
      const res = await request(app)
        .get('/api/v1/docker/templates/react-vite')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('react-vite');
      expect(res.body.data.content).toContain('FROM node:20-alpine AS builder');
      expect(res.body.data.content).toContain('nginx');
    });

    it('should return 404 for nonexistent template', async () => {
      const res = await request(app)
        .get('/api/v1/docker/templates/nonexistent-lang')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/docker/generate', () => {
    it('should generate a valid custom Dockerfile with non-root security', async () => {
      const res = await request(app)
        .post('/api/v1/docker/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          language: 'Node.js',
          baseImage: 'node:20-alpine',
          port: 3000,
          workdir: '/app',
          installCmd: 'npm ci',
          buildCmd: 'npm run build',
          startCmd: 'node dist/index.js',
          nonRootUser: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dockerfile).toContain('EXPOSE 3000');
      expect(res.body.data.dockerfile).toContain('USER appuser');
      expect(res.body.data.dockerfile).toContain('CMD ["node", "dist/index.js"]');
    });
  });
});
