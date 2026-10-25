import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { env } from '../config/env.js';
import { generateAccessToken } from '../utils/jwt.js';

const runnerToken = process.env.DOCKER_RUNNER_TOKEN!;
const userToken = generateAccessToken({
  sub: 'docker-runner-test-user',
  role: 'DEVELOPER',
});

const validSnapshot = {
  runnerId: 'windows-dev-pc',
  hostname: 'dev-pc',
  dockerVersion: 'Docker version test',
  serverVersion: '29.0.0',
  containersRunning: 0,
  containersTotal: 0,
  imagesTotal: 0,
  reportedAt: new Date().toISOString(),
};

describe('Docker Runner API', () => {
  describe('Authentication', () => {
    it('rejects heartbeat without credentials', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .send(validSnapshot);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/authentication required/i);
    });

    it('rejects non-Bearer authentication scheme', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', `Basic ${runnerToken}`)
        .send(validSnapshot);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid runner credentials (different length)', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', 'Bearer invalid-token-short')
        .send(validSnapshot);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid runner credentials/i);
    });

    it('rejects invalid runner credentials (same length)', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', `Bearer ${'x'.repeat(runnerToken.length)}`)
        .send(validSnapshot);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid runner credentials/i);
    });
  });

  describe('Runner ID Validation', () => {
    it('rejects runner ID with illegal characters or spaces', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ ...validSnapshot, runnerId: 'invalid runner id with spaces' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects runner ID containing path traversal or shell characters', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ ...validSnapshot, runnerId: '../../etc/passwd;rm' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects empty runner ID', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ ...validSnapshot, runnerId: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects runner ID exceeding maximum length (100 characters)', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ ...validSnapshot, runnerId: 'a'.repeat(101) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthorized runner ID when DOCKER_RUNNER_ID is configured', async () => {
      const originalRunnerId = env.DOCKER_RUNNER_ID;
      try {
        // Temporarily configure fixed runner ID
        env.DOCKER_RUNNER_ID = 'authorized-runner-id';

        const res = await request(app)
          .post('/api/v1/docker/runner/heartbeat')
          .set('Authorization', `Bearer ${runnerToken}`)
          .send({ ...validSnapshot, runnerId: 'different-runner-id' });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Unauthorized runner ID.');
      } finally {
        env.DOCKER_RUNNER_ID = originalRunnerId;
      }
    });
  });

  describe('Payload Validation', () => {
    it('rejects payload where containersRunning > containersTotal', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ ...validSnapshot, containersRunning: 5, containersTotal: 2 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects negative container counts', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ ...validSnapshot, containersRunning: -1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects payload with extra unexpected fields (strict schema)', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ ...validSnapshot, maliciousCommand: 'echo exploit' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects payload with excessive timestamp drift (stale replay attack)', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ ...validSnapshot, reportedAt: tenMinutesAgo });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toMatch(/acceptable time drift window/i);
    });

    it('rejects payload with excessive future timestamp drift', async () => {
      const tenMinutesFuture = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ ...validSnapshot, reportedAt: tenMinutesFuture });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Heartbeat Reception & Status Queries', () => {
    it('accepts a valid authenticated heartbeat', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/heartbeat')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ ...validSnapshot, reportedAt: new Date().toISOString() });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Docker runner heartbeat accepted.');
    });

    it('requires user authentication to read runner status', async () => {
      const res = await request(app)
        .get('/api/v1/docker/runner/status');

      expect(res.status).toBe(401);
    });

    it('allows an authenticated user to read runner status', async () => {
      const res = await request(app)
        .get('/api/v1/docker/runner/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.online).toBe('boolean');
      expect(res.body.data.online).toBe(true);
      expect(res.body.data.snapshot.runnerId).toBe('windows-dev-pc');
    });
  });

  describe('Runner Job Polling API', () => {
    it('rejects unauthenticated poll request with 401', async () => {
      const res = await request(app).post('/api/v1/docker/runner/jobs/poll').send({});
      expect(res.status).toBe(401);
    });

    it('rejects unauthorized runner ID with 403 when DOCKER_RUNNER_ID is configured', async () => {
      const originalRunnerId = env.DOCKER_RUNNER_ID;
      try {
        env.DOCKER_RUNNER_ID = 'correct-runner';
        const res = await request(app)
          .post('/api/v1/docker/runner/jobs/poll')
          .set('Authorization', `Bearer ${runnerToken}`)
          .send({ runnerId: 'wrong-runner' });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Unauthorized runner ID.');
      } finally {
        env.DOCKER_RUNNER_ID = originalRunnerId;
      }
    });

    it('accepts authorized poll request and returns 200 with data null or payload', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/jobs/poll')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ runnerId: 'windows-docker-runner' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
