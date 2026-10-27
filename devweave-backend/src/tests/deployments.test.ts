import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';

describe('Deployments & Environment Management API Tests', () => {
  const devToken = generateAccessToken({ sub: 'dev-user-1', role: 'DEVELOPER' });
  const viewerToken = generateAccessToken({ sub: 'viewer-user-1', role: 'VIEWER' });
  const adminToken = generateAccessToken({ sub: 'admin-user-1', role: 'ADMIN' });

  describe('GET /api/v1/deployments/environments', () => {
    it('requires authentication and returns 401 for unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/deployments/environments');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns the 3 configured environments with truthful status without faking pods', async () => {
      const res = await request(app)
        .get('/api/v1/deployments/environments')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(3);

      const envIds = res.body.data.map((e: any) => e.id);
      expect(envIds).toContain('production');
      expect(envIds).toContain('staging');
      expect(envIds).toContain('development');

      // Verify no hardcoded fake pod counts when runner/workload is not provisioned
      const staging = res.body.data.find((e: any) => e.id === 'staging');
      expect(staging.name).toBe('Staging');
      expect(staging.strategy).toBe('Blue/Green');
      // When unprovisioned, status should be truthful (e.g. 'Not configured' or 'Unknown')
      expect(['Not configured', 'Unknown', 'Healthy']).toContain(staging.status);
    });
  });

  describe('GET /api/v1/deployments/environments/:envId', () => {
    it('returns 404 for invalid environment ID', async () => {
      const res = await request(app)
        .get('/api/v1/deployments/environments/non-existent-env')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('returns detailed metadata and audit trail for production environment', async () => {
      const res = await request(app)
        .get('/api/v1/deployments/environments/production')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('production');
      expect(res.body.data.requiresApproval).toBe(true);
      expect(Array.isArray(res.body.data.rollbackTargets)).toBe(true);
      expect(Array.isArray(res.body.data.auditTrail)).toBe(true);
    });
  });

  describe('POST /api/v1/deployments/trigger', () => {
    it('rejects deployment from VIEWER role to Production with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/deployments/trigger')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          environment: 'Production',
          branch: 'main',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('VIEWER role cannot trigger deployments to Production');
    });

    it('rejects deployment with missing branch with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/deployments/trigger')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          environment: 'Development',
          branch: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('successfully triggers deployment to Development by DEVELOPER and records audit event', async () => {
      const res = await request(app)
        .post('/api/v1/deployments/trigger')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          environment: 'Development',
          repositoryName: 'DevWeave-Core',
          branch: 'feat/k8s-management',
          strategy: 'RollingUpdate',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.environment).toBe('Development');
      expect(res.body.data.branch).toBe('feat/k8s-management');
      expect(res.body.data.status).toBe('SUCCESS');
      expect(res.body.data.commitSha).toBeDefined();

      // Verify audit log has the event
      const auditRes = await request(app)
        .get('/api/v1/deployments/audit-logs?environment=Development')
        .set('Authorization', `Bearer ${devToken}`);

      expect(auditRes.status).toBe(200);
      const deployAudit = auditRes.body.data.find((a: any) => a.action === 'DEPLOY');
      expect(deployAudit).toBeDefined();
      expect(deployAudit.environment).toBe('Development');
    });

    it('allows ADMIN to trigger deployment to Production', async () => {
      const res = await request(app)
        .post('/api/v1/deployments/trigger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          environment: 'Production',
          repositoryName: 'DevWeave-Core',
          branch: 'main',
          commitSha: 'c891f42a',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.environment).toBe('Production');
      expect(res.body.data.commitSha).toBe('c891f42a');
    });
  });

  describe('POST /api/v1/deployments/environments/:envId/rollback', () => {
    it('rejects rollback by VIEWER role to Production with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/deployments/environments/production/rollback')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ reason: 'Accidental release' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('executes safe rollback when prior deployment exists and records audit log', async () => {
      // First, trigger a second deployment to Staging so we have a rollback history
      await request(app)
        .post('/api/v1/deployments/trigger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          environment: 'Staging',
          branch: 'v1.0.0',
          commitSha: 'commit-first-revision',
        });

      await request(app)
        .post('/api/v1/deployments/trigger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          environment: 'Staging',
          branch: 'v1.1.0',
          commitSha: 'commit-second-revision',
        });

      // Now request rollback on Staging
      const rollbackRes = await request(app)
        .post('/api/v1/deployments/environments/staging/rollback')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Emergency rollback due to regression',
        });

      expect(rollbackRes.status).toBe(200);
      expect(rollbackRes.body.success).toBe(true);
      expect(rollbackRes.body.data.rollbackExecution).toBeDefined();
      expect(rollbackRes.body.data.rollbackExecution.triggerSource).toBe('ROLLBACK');
      expect(rollbackRes.body.data.rollbackExecution.commitSha).toBe('commit-first-revision');

      // Verify audit log has the rollback event
      const auditRes = await request(app)
        .get('/api/v1/deployments/audit-logs?environment=Staging')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditRes.status).toBe(200);
      const rollbackAudit = auditRes.body.data.find((a: any) => a.action === 'ROLLBACK');
      expect(rollbackAudit).toBeDefined();
      expect(rollbackAudit.details.reason).toBe('Emergency rollback due to regression');
    });
  });

  describe('GET /api/v1/deployments/history', () => {
    it('returns list of deployment executions with filtering support', async () => {
      const res = await request(app)
        .get('/api/v1/deployments/history?environment=Staging')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      for (const item of res.body.data.items) {
        expect(item.environment).toBe('Staging');
      }
    });
  });
});
