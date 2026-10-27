import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';
import {
  saveKubernetesRunnerSnapshot,
  clearKubernetesRunnerSnapshot,
} from '../services/kubernetesRunnerService.js';
import { maskSecretData } from '../services/kubernetesProtectionService.js';
import { validateK8sYaml } from '../services/kubernetesService.js';

describe('Kubernetes Orchestration & Management API Tests', () => {
  const token = generateAccessToken({ sub: 'k8s-test-user', role: 'DEVELOPER' });
  const runnerToken = process.env.KUBERNETES_RUNNER_TOKEN || process.env.DOCKER_RUNNER_TOKEN!;

  const validSnapshot = {
    runnerId: 'windows-k8s-runner',
    hostname: 'test-runner-host',
    kubectlVersion: 'v1.28.2',
    clusterConnected: true,
    currentContext: 'docker-desktop',
    clusterEndpoint: 'https://127.0.0.1:6443',
    serverVersion: 'v1.28.2',
    nodesCount: 1,
    namespacesCount: 4,
    podsCount: 12,
    reportedAt: new Date().toISOString(),
  };

  // -------------------------------------------------------------
  // Suite 1: Status & Templates
  // -------------------------------------------------------------
  describe('GET /api/v1/kubernetes/status', () => {
    it('should return cluster connectivity telemetry', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

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

    it('should return blueprint detail by id', async () => {
      const res = await request(app)
        .get('/api/v1/kubernetes/templates/deployment')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toContain('kind: Deployment');
    });

    it('should return 404 for non-existent blueprint id', async () => {
      const res = await request(app)
        .get('/api/v1/kubernetes/templates/non-existent-template-xyz')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------
  // Suite 2: Manifest Generation & Multi-Doc Schema Validation
  // -------------------------------------------------------------
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
    it('should validate valid Kubernetes manifest and detect resources', async () => {
      const validYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: test-app
  template:
    metadata:
      labels:
        app: test-app
    spec:
      containers:
        - name: web
          image: nginx:alpine
---
apiVersion: v1
kind: Service
metadata:
  name: test-svc
  namespace: default
spec:
  ports:
    - port: 80`;

      const res = await request(app)
        .post('/api/v1/kubernetes/validate')
        .set('Authorization', `Bearer ${token}`)
        .send({ yaml: validYaml });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.parsedDocuments).toBe(2);
      expect(res.body.data.resources).toHaveLength(2);
      expect(res.body.data.resources[0].name).toBe('test-app');
      expect(res.body.data.resources[1].name).toBe('test-svc');
    });

    it('should detect missing apiVersion, kind, or metadata.name', async () => {
      const invalidYaml = `foo: bar
metadata:
  namespace: test`;

      const res = await request(app)
        .post('/api/v1/kubernetes/validate')
        .set('Authorization', `Bearer ${token}`)
        .send({ yaml: invalidYaml });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.errors.length).toBeGreaterThan(0);
    });

    it('should detect selector label mismatch in Deployment', () => {
      const mismatchedYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: mismatch-app
spec:
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: app
          image: nginx`;

      const result = validateK8sYaml(mismatchedYaml);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('does not match template label'))).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // Suite 3: Runner Heartbeat, Status & Auth
  // -------------------------------------------------------------
  describe('Kubernetes Runner Authentication & Heartbeat', () => {
    it('accepts authenticated heartbeat with valid runner token', async () => {
      const res = await request(app)
        .post('/api/v1/kubernetes/runner/heartbeat')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send(validSnapshot);

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
    });

    it('rejects runner heartbeat without authorization token', async () => {
      const res = await request(app)
        .post('/api/v1/kubernetes/runner/heartbeat')
        .send(validSnapshot);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects runner heartbeat with invalid token', async () => {
      const res = await request(app)
        .post('/api/v1/kubernetes/runner/heartbeat')
        .set('Authorization', 'Bearer invalid_runner_token_12345678901234567890')
        .send(validSnapshot);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns runner online status', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const res = await request(app)
        .get('/api/v1/kubernetes/runner/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.online).toBe(true);
      expect(res.body.data.snapshot.runnerId).toBe('windows-k8s-runner');
    });
  });

  // -------------------------------------------------------------
  // Suite 4: Inventory Push and Snapshot
  // -------------------------------------------------------------
  describe('Kubernetes Inventory Ingestion & Retrieval', () => {
    it('accepts inventory snapshot from authenticated runner', async () => {
      const sampleInventory = {
        clusterConnected: true,
        context: 'docker-desktop',
        serverVersion: 'v1.28.2',
        clientVersion: 'v1.28.2',
        endpoint: 'https://127.0.0.1:6443',
        namespaces: [{ name: 'default', status: 'Active', age: '10d', isProtected: true }],
        nodes: [{ name: 'docker-desktop', status: 'Ready', roles: ['control-plane'], age: '10d', version: 'v1.28.2' }],
        deployments: [
          {
            name: 'order-api',
            namespace: 'default',
            replicas: 2,
            readyReplicas: 2,
            availableReplicas: 2,
            updatedReplicas: 2,
            age: '2d',
            images: ['devweave/order-api:v1'],
            selector: { app: 'order-api' },
          },
        ],
        pods: [
          {
            name: 'order-api-7b89f-abcd',
            namespace: 'default',
            phase: 'Running',
            status: 'Running',
            readyContainers: 1,
            totalContainers: 1,
            restarts: 0,
            age: '2d',
            images: ['devweave/order-api:v1'],
            containers: [{ name: 'order-api', image: 'devweave/order-api:v1', ready: true, restartCount: 0 }],
          },
        ],
        services: [
          {
            name: 'order-service',
            namespace: 'default',
            type: 'ClusterIP',
            clusterIP: '10.96.0.10',
            ports: [{ port: 80, targetPort: 8080, protocol: 'TCP' }],
            age: '2d',
          },
        ],
        ingresses: [],
        networkPolicies: [],
        configMaps: [{ name: 'app-config', namespace: 'default', dataCount: 2, keys: ['API_URL', 'TIMEOUT'], age: '5d' }],
        secrets: [{ name: 'db-credentials', namespace: 'default', type: 'Opaque', dataCount: 2, keys: ['user', 'password'], age: '5d' }],
        serviceAccounts: [{ name: 'default', namespace: 'default', secretsCount: 1, age: '10d' }],
        persistentVolumeClaims: [],
        persistentVolumes: [],
        storageClasses: [],
        events: [],
      };

      const res = await request(app)
        .post('/api/v1/kubernetes/runner/inventory')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send(sampleInventory);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify retrieval via user API
      const getRes = await request(app)
        .get('/api/v1/kubernetes/inventory')
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.deployments).toHaveLength(1);
      expect(getRes.body.data.deployments[0].name).toBe('order-api');
      expect(getRes.body.data.services).toHaveLength(1);
      expect(getRes.body.data.secrets).toHaveLength(1);
      expect(getRes.body.data.secrets[0].keys).toContain('user');
    });
  });

  // -------------------------------------------------------------
  // Suite 5: Safety & Resource Protection Safeguards
  // -------------------------------------------------------------
  describe('Kubernetes Safety & Resource Protection Rules', () => {
    it('blocks deletion of protected namespaces', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      for (const ns of ['kube-system', 'kube-public', 'kube-node-lease', 'default']) {
        const res = await request(app)
          .delete(`/api/v1/kubernetes/namespaces/${ns}`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toContain('system-critical or default');
      }
    });

    it('blocks deletion of core kubernetes API service in default namespace', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const res = await request(app)
        .delete('/api/v1/kubernetes/resources/service/kubernetes?namespace=default')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('core "kubernetes" API service');
    });

    it('blocks modification/deletion of resources in kube-system namespace', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const res = await request(app)
        .delete('/api/v1/kubernetes/resources/pod/coredns-5d78c9869d-xyz?namespace=kube-system')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('"kube-system" namespace is restricted');
    });

    it('ensures secret data is masked by maskSecretData helper', () => {
      const secretObject = {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: 'db-pass', namespace: 'default' },
        data: {
          password: 'c3VwZXJzZWNyZXQ=',
          token: 'YW5vdGhlcnNlY3JldA==',
        },
      };

      const masked = maskSecretData(secretObject);
      expect(masked.data.password).toBe('••••••••');
      expect(masked.data.token).toBe('••••••••');
    });
  });

  // -------------------------------------------------------------
  // Suite 6: Workload Management & Job Polling Lifecycle
  // -------------------------------------------------------------
  describe('Workload Management Execution Lifecycle', () => {
    it('applies manifest by leasing and completing runner job', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const validManifest = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: micro-service
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: micro-service
  template:
    metadata:
      labels:
        app: micro-service
    spec:
      containers:
        - name: app
          image: nginx:alpine`;

      // Simulate runner polling in background
      const runnerPollTimer = setTimeout(async () => {
        try {
          const pollRes = await request(app)
            .post('/api/v1/kubernetes/runner/jobs/poll')
            .set('Authorization', `Bearer ${runnerToken}`)
            .send({ runnerId: 'windows-k8s-runner' });

          if (pollRes.body?.data?.id) {
            expect(pollRes.body.data.actionType).toBe('K8S_APPLY_MANIFEST');
            expect(pollRes.body.data.params.yaml).toContain('micro-service');

            await request(app)
              .post(`/api/v1/kubernetes/runner/jobs/${pollRes.body.data.id}/complete`)
              .set('Authorization', `Bearer ${runnerToken}`)
              .send({
                success: true,
                data: { applied: true, output: 'deployment.apps/micro-service created' },
              });
          }
        } catch {
          // background simulation
        }
      }, 30);

      const res = await request(app)
        .post('/api/v1/kubernetes/apply')
        .set('Authorization', `Bearer ${token}`)
        .send({ yaml: validManifest });

      clearTimeout(runnerPollTimer);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.applied).toBe(true);
    });

    it('scales deployment through runner job dispatch', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const runnerPollTimer = setTimeout(async () => {
        try {
          const pollRes = await request(app)
            .post('/api/v1/kubernetes/runner/jobs/poll')
            .set('Authorization', `Bearer ${runnerToken}`)
            .send({ runnerId: 'windows-k8s-runner' });

          if (pollRes.body?.data?.id) {
            expect(pollRes.body.data.actionType).toBe('K8S_SCALE_RESOURCE');
            expect(pollRes.body.data.params.name).toBe('order-api');
            expect(pollRes.body.data.params.replicas).toBe(5);

            await request(app)
              .post(`/api/v1/kubernetes/runner/jobs/${pollRes.body.data.id}/complete`)
              .set('Authorization', `Bearer ${runnerToken}`)
              .send({
                success: true,
                data: { scaled: true, replicas: 5, output: 'deployment.apps/order-api scaled' },
              });
          }
        } catch {
          //
        }
      }, 30);

      const res = await request(app)
        .post('/api/v1/kubernetes/workloads/scale')
        .set('Authorization', `Bearer ${token}`)
        .send({
          kind: 'deployment',
          name: 'order-api',
          namespace: 'default',
          replicas: 5,
        });

      clearTimeout(runnerPollTimer);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('scaled to 5 replicas');
    });

    it('triggers rollout restart for deployment', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const runnerPollTimer = setTimeout(async () => {
        try {
          const pollRes = await request(app)
            .post('/api/v1/kubernetes/runner/jobs/poll')
            .set('Authorization', `Bearer ${runnerToken}`)
            .send({ runnerId: 'windows-k8s-runner' });

          if (pollRes.body?.data?.id) {
            expect(pollRes.body.data.actionType).toBe('K8S_RESTART_RESOURCE');

            await request(app)
              .post(`/api/v1/kubernetes/runner/jobs/${pollRes.body.data.id}/complete`)
              .set('Authorization', `Bearer ${runnerToken}`)
              .send({
                success: true,
                data: { restarted: true, output: 'deployment.apps/order-api restarted' },
              });
          }
        } catch {
          //
        }
      }, 30);

      const res = await request(app)
        .post('/api/v1/kubernetes/workloads/restart')
        .set('Authorization', `Bearer ${token}`)
        .send({
          kind: 'deployment',
          name: 'order-api',
          namespace: 'default',
        });

      clearTimeout(runnerPollTimer);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Rollout restart triggered');
    });

    it('creates namespace safely with valid DNS-1123 name', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const runnerPollTimer = setTimeout(async () => {
        try {
          const pollRes = await request(app)
            .post('/api/v1/kubernetes/runner/jobs/poll')
            .set('Authorization', `Bearer ${runnerToken}`)
            .send({ runnerId: 'windows-k8s-runner' });

          if (pollRes.body?.data?.id) {
            expect(pollRes.body.data.actionType).toBe('K8S_CREATE_NAMESPACE');
            expect(pollRes.body.data.params.name).toBe('feature-test');

            await request(app)
              .post(`/api/v1/kubernetes/runner/jobs/${pollRes.body.data.id}/complete`)
              .set('Authorization', `Bearer ${runnerToken}`)
              .send({
                success: true,
                data: { created: true, name: 'feature-test' },
              });
          }
        } catch {
          //
        }
      }, 30);

      const res = await request(app)
        .post('/api/v1/kubernetes/namespaces')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'feature-test' });

      clearTimeout(runnerPollTimer);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('created successfully');
    });

    it('rejects invalid namespace name format with 400', async () => {
      const res = await request(app)
        .post('/api/v1/kubernetes/namespaces')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'INVALID_NAME_WITH_CAPS!' });

      expect(res.status).toBe(400);
    });

    it('records audit events for mutations and retrieves audit logs', async () => {
      const auditRes = await request(app)
        .get('/api/v1/kubernetes/audit-logs')
        .set('Authorization', `Bearer ${token}`);

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.success).toBe(true);
      expect(Array.isArray(auditRes.body.data)).toBe(true);
      expect(auditRes.body.data.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------
  // Suite 7: Offline Runner Error Handling
  // -------------------------------------------------------------
  describe('Offline Runner Handling', () => {
    it('returns 503 with actionable error when runner is offline', async () => {
      clearKubernetesRunnerSnapshot();

      const res = await request(app)
        .post('/api/v1/kubernetes/workloads/scale')
        .set('Authorization', `Bearer ${token}`)
        .send({
          kind: 'deployment',
          name: 'any-workload',
          namespace: 'default',
          replicas: 3,
        });

      expect(res.status).toBe(503);
      expect(res.body.message).toContain('runner is currently offline');
      expect(res.body.message).toContain('npm run runner:k8s');
    });
  });

  // -------------------------------------------------------------
  // Suite 8: Resource Inspection & Pod Logs
  // -------------------------------------------------------------
  describe('Resource Inspection & Logs Endpoints', () => {
    it('fetches resource YAML via runner job dispatch', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const runnerPollTimer = setTimeout(async () => {
        try {
          const pollRes = await request(app)
            .post('/api/v1/kubernetes/runner/jobs/poll')
            .set('Authorization', `Bearer ${runnerToken}`)
            .send({ runnerId: 'windows-k8s-runner' });

          if (pollRes.body?.data?.id) {
            expect(pollRes.body.data.actionType).toBe('K8S_GET_RESOURCE_YAML');
            await request(app)
              .post(`/api/v1/kubernetes/runner/jobs/${pollRes.body.data.id}/complete`)
              .set('Authorization', `Bearer ${runnerToken}`)
              .send({
                success: true,
                data: { yaml: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: order-svc' },
              });
          }
        } catch {
          //
        }
      }, 30);

      const res = await request(app)
        .get('/api/v1/kubernetes/resources/service/order-svc/yaml?namespace=default')
        .set('Authorization', `Bearer ${token}`);

      clearTimeout(runnerPollTimer);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.yaml).toContain('order-svc');
    });

    it('fetches kubectl describe output via runner job dispatch', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const runnerPollTimer = setTimeout(async () => {
        try {
          const pollRes = await request(app)
            .post('/api/v1/kubernetes/runner/jobs/poll')
            .set('Authorization', `Bearer ${runnerToken}`)
            .send({ runnerId: 'windows-k8s-runner' });

          if (pollRes.body?.data?.id) {
            expect(pollRes.body.data.actionType).toBe('K8S_GET_DESCRIBE');
            await request(app)
              .post(`/api/v1/kubernetes/runner/jobs/${pollRes.body.data.id}/complete`)
              .set('Authorization', `Bearer ${runnerToken}`)
              .send({
                success: true,
                data: { description: 'Name: order-svc\nNamespace: default\nLabels: app=order' },
              });
          }
        } catch {
          //
        }
      }, 30);

      const res = await request(app)
        .get('/api/v1/kubernetes/resources/service/order-svc/describe?namespace=default')
        .set('Authorization', `Bearer ${token}`);

      clearTimeout(runnerPollTimer);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toContain('Name: order-svc');
    });

    it('fetches container logs from pod with tail limit', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const runnerPollTimer = setTimeout(async () => {
        try {
          const pollRes = await request(app)
            .post('/api/v1/kubernetes/runner/jobs/poll')
            .set('Authorization', `Bearer ${runnerToken}`)
            .send({ runnerId: 'windows-k8s-runner' });

          if (pollRes.body?.data?.id) {
            expect(pollRes.body.data.actionType).toBe('K8S_GET_LOGS');
            expect(pollRes.body.data.params.tailLines).toBe(50);
            await request(app)
              .post(`/api/v1/kubernetes/runner/jobs/${pollRes.body.data.id}/complete`)
              .set('Authorization', `Bearer ${runnerToken}`)
              .send({
                success: true,
                data: {
                  podName: 'order-api-7b89f-abcd',
                  namespace: 'default',
                  logs: '[INFO] Server started on port 8080\n[INFO] Healthcheck OK',
                },
              });
          }
        } catch {
          //
        }
      }, 30);

      const res = await request(app)
        .get('/api/v1/kubernetes/pods/default/order-api-7b89f-abcd/logs?tailLines=50')
        .set('Authorization', `Bearer ${token}`);

      clearTimeout(runnerPollTimer);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs).toContain('Server started on port 8080');
    });
  });

  // -------------------------------------------------------------
  // Suite 9: Secret Decryption & Authorized Reveal Flow
  // -------------------------------------------------------------
  describe('Authorized Secret Reveal Endpoint', () => {
    it('reveals secret key through authorized decryption and logs audit event', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const runnerPollTimer = setTimeout(async () => {
        try {
          const pollRes = await request(app)
            .post('/api/v1/kubernetes/runner/jobs/poll')
            .set('Authorization', `Bearer ${runnerToken}`)
            .send({ runnerId: 'windows-k8s-runner' });

          if (pollRes.body?.data?.id) {
            expect(pollRes.body.data.actionType).toBe('K8S_REVEAL_SECRET');
            expect(pollRes.body.data.params.key).toBe('DB_PASSWORD');

            await request(app)
              .post(`/api/v1/kubernetes/runner/jobs/${pollRes.body.data.id}/complete`)
              .set('Authorization', `Bearer ${runnerToken}`)
              .send({
                success: true,
                data: { key: 'DB_PASSWORD', value: 'DecryptedP@ssword123!' },
              });
          }
        } catch {
          //
        }
      }, 30);

      const res = await request(app)
        .post('/api/v1/kubernetes/secrets/reveal')
        .set('Authorization', `Bearer ${token}`)
        .send({
          namespace: 'default',
          name: 'db-credentials',
          key: 'DB_PASSWORD',
        });

      clearTimeout(runnerPollTimer);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.key).toBe('DB_PASSWORD');
      expect(res.body.data.value).toBe('DecryptedP@ssword123!');

      // Check audit log contains record of secret reveal
      const auditRes = await request(app)
        .get('/api/v1/kubernetes/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      const revealAudit = auditRes.body.data.find(
        (e: { action: string; resourceName: string }) =>
          e.action === 'K8S_REVEAL_SECRET' && e.resourceName === 'db-credentials'
      );
      expect(revealAudit).toBeDefined();
      expect(revealAudit.status).toBe('SUCCESS');
    });
  });

  // -------------------------------------------------------------
  // Suite 10: Resource Deletion Lifecycle
  // -------------------------------------------------------------
  describe('Resource Deletion Execution', () => {
    it('deletes user service through runner job dispatch', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const runnerPollTimer = setTimeout(async () => {
        try {
          const pollRes = await request(app)
            .post('/api/v1/kubernetes/runner/jobs/poll')
            .set('Authorization', `Bearer ${runnerToken}`)
            .send({ runnerId: 'windows-k8s-runner' });

          if (pollRes.body?.data?.id) {
            expect(pollRes.body.data.actionType).toBe('K8S_DELETE_RESOURCE');
            expect(pollRes.body.data.params.name).toBe('test-service');

            await request(app)
              .post(`/api/v1/kubernetes/runner/jobs/${pollRes.body.data.id}/complete`)
              .set('Authorization', `Bearer ${runnerToken}`)
              .send({
                success: true,
                data: { deleted: true, output: 'service "test-service" deleted' },
              });
          }
        } catch {
          //
        }
      }, 30);

      const res = await request(app)
        .delete('/api/v1/kubernetes/resources/service/test-service?namespace=default')
        .set('Authorization', `Bearer ${token}`);

      clearTimeout(runnerPollTimer);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted successfully');
    });
  });

  // -------------------------------------------------------------
  // Suite 11: Input Validation & Edge Cases
  // -------------------------------------------------------------
  describe('Input Validation & Edge Cases', () => {
    it('rejects scale with negative replicas', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const res = await request(app)
        .post('/api/v1/kubernetes/workloads/scale')
        .set('Authorization', `Bearer ${token}`)
        .send({
          kind: 'deployment',
          name: 'my-app',
          namespace: 'default',
          replicas: -1,
        });

      expect(res.status).toBe(400);
    });

    it('rejects scale with non-scalable kind', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const res = await request(app)
        .post('/api/v1/kubernetes/workloads/scale')
        .set('Authorization', `Bearer ${token}`)
        .send({
          kind: 'configmap',
          name: 'my-config',
          namespace: 'default',
          replicas: 2,
        });

      expect(res.status).toBe(400);
    });

    it('rejects secret reveal without key', async () => {
      const res = await request(app)
        .post('/api/v1/kubernetes/secrets/reveal')
        .set('Authorization', `Bearer ${token}`)
        .send({
          namespace: 'default',
          name: 'my-secret',
        });

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------
  // Suite 12: Service Creation API (POST /services)
  // -------------------------------------------------------------
  describe('POST /api/v1/kubernetes/services', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/v1/kubernetes/services')
        .send({
          name: 'my-service',
          namespace: 'default',
          type: 'ClusterIP',
          selector: { app: 'web' },
          port: 80,
          targetPort: 8080,
        });

      expect(res.status).toBe(401);
    });

    it('rejects service creation when runner is offline with 503', async () => {
      clearKubernetesRunnerSnapshot();

      const res = await request(app)
        .post('/api/v1/kubernetes/services')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'my-service',
          namespace: 'default',
          type: 'ClusterIP',
          selector: { app: 'web' },
          port: 80,
          targetPort: 8080,
        });

      expect(res.status).toBe(503);
      expect(res.body.message).toContain('runner is currently offline');
    });

    it('rejects creating or overwriting default/kubernetes core service with 403', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const res = await request(app)
        .post('/api/v1/kubernetes/services')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'kubernetes',
          namespace: 'default',
          type: 'ClusterIP',
          selector: { app: 'k8s' },
          port: 443,
          targetPort: 443,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('core system "kubernetes" service');
    });

    it('rejects invalid service name format with 400', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const res = await request(app)
        .post('/api/v1/kubernetes/services')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'INVALID_UPPERCASE_NAME!',
          namespace: 'default',
          type: 'ClusterIP',
          selector: { app: 'web' },
          port: 80,
          targetPort: 8080,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Validation failed');
    });

    it('rejects invalid port number with 400', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const res = await request(app)
        .post('/api/v1/kubernetes/services')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'valid-service',
          namespace: 'default',
          type: 'ClusterIP',
          selector: { app: 'web' },
          port: 99999,
          targetPort: 8080,
        });

      expect(res.status).toBe(400);
    });

    it('rejects empty selector mapping with 400', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const res = await request(app)
        .post('/api/v1/kubernetes/services')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'valid-service',
          namespace: 'default',
          type: 'ClusterIP',
          selector: {},
          port: 80,
          targetPort: 8080,
        });

      expect(res.status).toBe(400);
    });

    it('creates service successfully and dispatches K8S_APPLY_MANIFEST job to runner', async () => {
      saveKubernetesRunnerSnapshot(validSnapshot);

      const runnerPollTimer = setTimeout(async () => {
        try {
          const pollRes = await request(app)
            .post('/api/v1/kubernetes/runner/jobs/poll')
            .set('Authorization', `Bearer ${runnerToken}`)
            .send({ runnerId: 'windows-k8s-runner' });

          if (pollRes.body?.data?.id) {
            expect(pollRes.body.data.actionType).toBe('K8S_APPLY_MANIFEST');
            expect(pollRes.body.data.params.yaml).toContain('kind: Service');
            expect(pollRes.body.data.params.yaml).toContain('devweave-test-svc');
            expect(pollRes.body.data.params.namespace).toBe('default');

            await request(app)
              .post(`/api/v1/kubernetes/runner/jobs/${pollRes.body.data.id}/complete`)
              .set('Authorization', `Bearer ${runnerToken}`)
              .send({
                success: true,
                data: { applied: true, output: 'service/devweave-test-svc created' },
              });
          }
        } catch {
          //
        }
      }, 30);

      const res = await request(app)
        .post('/api/v1/kubernetes/services')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'devweave-test-svc',
          namespace: 'default',
          type: 'ClusterIP',
          selector: { app: 'devweave-service' },
          port: 80,
          targetPort: 8080,
        });

      clearTimeout(runnerPollTimer);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('devweave-test-svc');
      expect(res.body.data.created).toBe(true);
      expect(res.body.data.name).toBe('devweave-test-svc');
      expect(res.body.data.namespace).toBe('default');
    });
  });
});
