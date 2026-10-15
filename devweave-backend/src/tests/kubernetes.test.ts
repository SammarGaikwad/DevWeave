import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';

describe('Kubernetes Orchestration API Tests', () => {
  const token = generateAccessToken({ sub: 'k8s-test-user', role: 'DEVELOPER' });

  describe('GET /api/v1/kubernetes/status', () => {
    it('should return cluster connectivity telemetry', async () => {
      const res = await request(app)
        .get('/api/v1/kubernetes/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.kubectlInstalled).toBe('boolean');
      expect(typeof res.body.data.clusterConnected).toBe('boolean');
      expect(['CONNECTED', 'DISCONNECTED', 'CLI_NOT_FOUND']).toContain(res.body.data.status);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/kubernetes/status');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/kubernetes/templates', () => {
    it('should return list of manifest blueprints', async () => {
      const res = await request(app)
        .get('/api/v1/kubernetes/templates')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);

      const deployTemplate = res.body.data.find((t: { id: string }) => t.id === 'deployment');
      expect(deployTemplate).toBeDefined();
      expect(deployTemplate.kind).toBe('Deployment');
    });
  });

  describe('POST /api/v1/kubernetes/generate', () => {
    it('should generate multi-document YAML with Deployment, Service, and Ingress', async () => {
      const res = await request(app)
        .post('/api/v1/kubernetes/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          serviceName: 'order-api',
          namespace: 'production',
          imageTag: 'registry.devweave.internal/order-api:v2.1.0',
          containerPort: 8080,
          replicas: 4,
          enableIngress: true,
          ingressHost: 'orders.devweave.internal',
          enableHpa: true,
          minReplicas: 2,
          maxReplicas: 8,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.yaml).toContain('name: order-api');
      expect(res.body.data.yaml).toContain('namespace: production');
      expect(res.body.data.yaml).toContain('kind: Deployment');
      expect(res.body.data.yaml).toContain('kind: Service');
      expect(res.body.data.yaml).toContain('kind: Ingress');
      expect(res.body.data.yaml).toContain('kind: HorizontalPodAutoscaler');
    });
  });

  describe('POST /api/v1/kubernetes/validate', () => {
    it('should validate valid Kubernetes manifest', async () => {
      const validYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
spec:
  replicas: 1`;

      const res = await request(app)
        .post('/api/v1/kubernetes/validate')
        .set('Authorization', `Bearer ${token}`)
        .send({ yaml: validYaml });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.errors.length).toBe(0);
    });

    it('should detect missing apiVersion or kind', async () => {
      const invalidYaml = `foo: bar
metadata:
  name: test-app`;

      const res = await request(app)
        .post('/api/v1/kubernetes/validate')
        .set('Authorization', `Bearer ${token}`)
        .send({ yaml: invalidYaml });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.errors.length).toBeGreaterThan(0);
    });
  });
});
