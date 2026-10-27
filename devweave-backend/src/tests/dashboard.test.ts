import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';

describe('Engineering Dashboard API (/api/v1/dashboard)', () => {
  const devToken = generateAccessToken({ sub: 'user-dev-dash-1', role: 'DEVELOPER' });


  describe('GET /api/v1/dashboard/summary', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/dashboard/summary');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid period parameter with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary?period=invalid_period')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid period parameter');
    });

    it('returns comprehensive engineering overview with default 7d period', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.body).toEqual({ success: true, data: expect.anything() });
      expect(res.status).toBe(200);


      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const { data } = res.body;

      // 1. Integration Health Structure
      expect(data.integrationHealth).toBeDefined();
      expect(['HEALTHY', 'DEGRADED', 'DOWN']).toContain(data.integrationHealth.overallStatus);
      expect(typeof data.integrationHealth.healthyCount).toBe('number');
      expect(typeof data.integrationHealth.totalCount).toBe('number');
      expect(data.integrationHealth.integrations).toBeInstanceOf(Array);
      expect(data.integrationHealth.integrations.length).toBeGreaterThanOrEqual(6);

      const integrationIds = data.integrationHealth.integrations.map((i: any) => i.id);
      expect(integrationIds).toContain('backend');
      expect(integrationIds).toContain('database');
      expect(integrationIds).toContain('github');
      expect(integrationIds).toContain('jenkins');
      expect(integrationIds).toContain('kubernetes_runner');
      expect(integrationIds).toContain('docker_runner');
      expect(integrationIds).toContain('deployments');

      // 2. Metrics Structure
      expect(data.metrics).toBeDefined();

      // Repositories
      expect(typeof data.metrics.repositories.totalAccessible).toBe('number');
      expect(typeof data.metrics.repositories.configuredInDevWeave).toBe('number');
      expect(typeof data.metrics.repositories.isGithubConnected).toBe('boolean');

      // Pipelines
      expect(data.metrics.pipelines.period).toBe('7d');
      expect(typeof data.metrics.pipelines.totalExecutions).toBe('number');
      expect(typeof data.metrics.pipelines.successful).toBe('number');
      expect(typeof data.metrics.pipelines.failed).toBe('number');
      expect(typeof data.metrics.pipelines.running).toBe('number');
      if (data.metrics.pipelines.totalExecutions > 0 && data.metrics.pipelines.successful + data.metrics.pipelines.failed > 0) {
        expect(typeof data.metrics.pipelines.successRate).toBe('number');
      }

      // Deployments
      expect(typeof data.metrics.deployments.configuredEnvironments).toBe('number');
      expect(typeof data.metrics.deployments.healthyEnvironments).toBe('number');
      expect(typeof data.metrics.deployments.successfulDeployments).toBe('number');

      // Infrastructure
      expect(data.metrics.infrastructure.kubernetes).toBeDefined();
      expect(['CONNECTED', 'DISCONNECTED', 'RUNNER_OFFLINE']).toContain(
        data.metrics.infrastructure.kubernetes.status
      );
      expect(typeof data.metrics.infrastructure.kubernetes.nodes.total).toBe('number');
      expect(typeof data.metrics.infrastructure.kubernetes.pods.total).toBe('number');

      expect(data.metrics.infrastructure.docker).toBeDefined();
      expect(['CONNECTED', 'DISCONNECTED', 'RUNNER_OFFLINE']).toContain(
        data.metrics.infrastructure.docker.status
      );
      expect(typeof data.metrics.infrastructure.docker.containers.total).toBe('number');

      // 3. Pipeline Trends
      expect(data.pipelineTrends).toBeDefined();
      expect(data.pipelineTrends.period).toBe('7d');
      expect(data.pipelineTrends.buckets).toBeInstanceOf(Array);
      expect(data.pipelineTrends.buckets.length).toBe(7);

      // 4. Executions & Activity Feed
      expect(data.recentExecutions).toBeInstanceOf(Array);
      expect(data.recentActivity).toBeInstanceOf(Array);
      expect(data.environments).toBeInstanceOf(Array);
    });

    it('supports 30d and 90d periods accurately', async () => {
      const res30 = await request(app)
        .get('/api/v1/dashboard/summary?period=30d')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res30.status).toBe(200);
      expect(res30.body.data.pipelineTrends.period).toBe('30d');
      expect(res30.body.data.pipelineTrends.buckets.length).toBe(30);

      const res90 = await request(app)
        .get('/api/v1/dashboard/summary?period=90d')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res90.status).toBe(200);
      expect(res90.body.data.pipelineTrends.period).toBe('90d');
      expect(res90.body.data.pipelineTrends.buckets.length).toBe(90);
    });
  });
});
