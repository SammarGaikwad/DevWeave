import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';
import {
  isResourceProtected,
  assertResourceNotProtected,
  assertNetworkDisconnectNotProtected,
  assertImagePruneNotProtected,
  recordAuditEvent,
  getAuditEvents,
  type DockerInventorySnapshot,
} from '../services/dockerProtectionService.js';
import {
  maskSecretsInObject,
  updateInventorySnapshot,
  getInventorySnapshot,
  executeManagementAction,
} from '../services/dockerManagementService.js';
import { saveRunnerSnapshot } from '../services/dockerRunnerService.js';

const userToken = generateAccessToken({
  sub: 'docker-manage-test-user',
  role: 'DEVELOPER',
});

const runnerToken = process.env.DOCKER_RUNNER_TOKEN!;

describe('Docker Management Feature Suite', () => {
  describe('1. Protected Resource Policy Safeguards', () => {
    it('correctly identifies protected containers', () => {
      expect(isResourceProtected('container', 'smart_review_backend_api')).toBe(true);
      expect(isResourceProtected('container', 'smart_review_analytics_engine')).toBe(true);
      expect(isResourceProtected('container', 'jenkins')).toBe(true);
      expect(isResourceProtected('container', '/jenkins')).toBe(true);
      expect(isResourceProtected('container', 'custom-web-service')).toBe(false);
    });

    it('correctly identifies protected networks', () => {
      expect(isResourceProtected('network', 'bridge')).toBe(true);
      expect(isResourceProtected('network', 'host')).toBe(true);
      expect(isResourceProtected('network', 'none')).toBe(true);
      expect(isResourceProtected('network', 'smart-review-analytics_smart_review_network')).toBe(true);
      expect(isResourceProtected('network', 'my-custom-net')).toBe(false);
    });

    it('correctly identifies protected volumes', () => {
      expect(isResourceProtected('volume', 'jenkins_home')).toBe(true);
      expect(isResourceProtected('volume', 'my_app_data')).toBe(false);
    });

    it('assertResourceNotProtected throws 403 on protected container', () => {
      expect(() => {
        assertResourceNotProtected('container', 'smart_review_backend_api', 'STOP');
      }).toThrow(/protected system container/);
    });

    it('assertResourceNotProtected throws 403 on built-in network', () => {
      expect(() => {
        assertResourceNotProtected('network', 'bridge', 'DELETE');
      }).toThrow(/protected system network/);
    });

    it('assertResourceNotProtected allows non-protected resource', () => {
      expect(() => {
        assertResourceNotProtected('container', 'my-test-container', 'STOP');
      }).not.toThrow();
    });
  });

  describe('2. Secret Masking in Inspect & Telemetry Payloads', () => {
    it('redacts sensitive keys in objects', () => {
      const payload = {
        name: 'test-app',
        apiKey: 'secret_12345',
        dbPassword: 'super_secret_password',
        authToken: 'eyJhbGciOiJIUzI1NiIsIn...',
        safeField: 'normal-value',
      };

      const masked = maskSecretsInObject(payload);
      expect(masked.apiKey).toBe('********');
      expect(masked.dbPassword).toBe('********');
      expect(masked.authToken).toBe('********');
      expect(masked.safeField).toBe('normal-value');
    });

    it('redacts sensitive environment variable strings in Docker Env arrays', () => {
      const payload = {
        Config: {
          Env: [
            'PORT=8080',
            'DATABASE_URL=postgres://user:secretpass@db:5432/db',
            'JWT_SECRET=supersecretjwtkey',
            'NODE_ENV=production',
          ],
        },
      };

      const masked = maskSecretsInObject(payload);
      expect(masked.Config.Env).toContain('PORT=8080');
      expect(masked.Config.Env).toContain('NODE_ENV=production');
      expect(masked.Config.Env).toContain('JWT_SECRET=********');
    });
  });

  describe('3. Inventory Snapshot Caching & Protection Badging', () => {
    it('stores and marks protected status on inventory items', () => {
      updateInventorySnapshot({
        containers: [
          {
            id: 'c12345678901',
            name: 'jenkins',
            image: 'jenkins/jenkins:lts',
            status: 'Up 2 hours',
            state: 'running',
            created: '2 hours ago',
            ports: [{ hostPort: 8080, containerPort: 8080, protocol: 'tcp' }],
            isProtected: false,
          },
          {
            id: 'c98765432109',
            name: 'test-app-service',
            image: 'checkkkk:main',
            status: 'Exited (0)',
            state: 'exited',
            created: '1 hour ago',
            ports: [],
            isProtected: false,
          },
        ],
        images: [
          {
            id: 'img123456789',
            repository: 'checkkkk',
            tag: 'main',
            size: '22MB',
            created: '1 hour ago',
            inUseByContainers: ['test-app-service'],
            isProtected: false,
            isDangling: false,
          },
        ],
        networks: [
          {
            id: 'net123456789',
            name: 'bridge',
            driver: 'bridge',
            scope: 'local',
            containers: [],
            isProtected: false,
          },
        ],
        volumes: [
          {
            name: 'jenkins_home',
            driver: 'local',
            inUseByContainers: ['jenkins'],
            isProtected: false,
          },
        ],
      });

      const inv = getInventorySnapshot();
      expect(inv.containers.find((c) => c.name === 'jenkins')?.isProtected).toBe(true);
      expect(inv.containers.find((c) => c.name === 'test-app-service')?.isProtected).toBe(false);
      expect(inv.networks.find((n) => n.name === 'bridge')?.isProtected).toBe(true);
      expect(inv.volumes.find((v) => v.name === 'jenkins_home')?.isProtected).toBe(true);
    });
  });

  describe('4. Audit Logging', () => {
    it('records and returns audit events', () => {
      recordAuditEvent({
        userId: 'user-audit-1',
        action: 'CONTAINER_STOP',
        resourceType: 'container',
        resourceName: 'test-container',
        status: 'SUCCESS',
      });

      const events = getAuditEvents(10);
      expect(events.length).toBeGreaterThan(0);
      const latest = events[0];
      expect(latest.action).toBe('CONTAINER_STOP');
      expect(latest.resourceName).toBe('test-container');
      expect(latest.status).toBe('SUCCESS');
    });
  });

  describe('5. REST Endpoints & Authentication', () => {
    it('requires authentication for inventory endpoint', async () => {
      const res = await request(app).get('/api/v1/docker/manage/inventory');
      expect(res.status).toBe(401);
    });

    it('returns inventory for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/docker/manage/inventory')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.containers)).toBe(true);
      expect(Array.isArray(res.body.data.images)).toBe(true);
      expect(Array.isArray(res.body.data.networks)).toBe(true);
      expect(Array.isArray(res.body.data.volumes)).toBe(true);
    });

    it('requires authentication for audit-logs endpoint', async () => {
      const res = await request(app).get('/api/v1/docker/manage/audit-logs');
      expect(res.status).toBe(401);
    });

    it('returns audit logs for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/docker/manage/audit-logs')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('6. Action Safeguards via API Endpoints', () => {
    it('blocks stopping a protected container via API', async () => {
      // Temporarily mark runner as online
      saveRunnerSnapshot({
        runnerId: 'windows-docker-runner',
        hostname: 'test-host',
        dockerVersion: '29.0.0',
        serverVersion: '29.0.0',
        containersRunning: 1,
        containersTotal: 3,
        imagesTotal: 5,
        reportedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/v1/docker/manage/containers/smart_review_backend_api/stop')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ timeoutSeconds: 5 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/protected system/i);
    });

    it('blocks deleting a protected container via API', async () => {
      const res = await request(app)
        .delete('/api/v1/docker/manage/containers/jenkins')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/protected system/i);
    });

    it('blocks deleting a built-in network via API', async () => {
      const res = await request(app)
        .delete('/api/v1/docker/manage/networks/bridge')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/protected system/i);
    });

    it('blocks deleting a protected volume via API', async () => {
      const res = await request(app)
        .delete('/api/v1/docker/manage/volumes/jenkins_home')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/protected system/i);
    });

    it('validates container creation parameters via Zod', async () => {
      const res = await request(app)
        .post('/api/v1/docker/manage/containers')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'invalid name with spaces!@#',
          image: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates network creation parameters via Zod', async () => {
      const res = await request(app)
        .post('/api/v1/docker/manage/networks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: '',
          driver: 'invalid_driver_type',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('7. Runner Inventory Telemetry & Polling Integration', () => {
    it('accepts runner inventory updates via authenticated endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/docker/runner/inventory')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({
          containers: [
            {
              id: 'c12345',
              name: 'app-service',
              image: 'checkkkk:main',
              status: 'Up 10 minutes',
              state: 'running',
              created: '10 minutes ago',
              ports: [],
            },
          ],
          images: [],
          networks: [],
          volumes: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const inv = getInventorySnapshot();
      expect(inv.containers.some((c) => c.name === 'app-service')).toBe(true);
    });

    it('prioritizes management jobs in runner job polling', async () => {
      // Trigger an async management action in the background
      const actionPromise = executeManagementAction(
        'CONTAINER_START',
        { containerId: 'custom-demo-container' },
        { id: 'test-user-id' },
        3000
      );

      // Poll runner job as runner
      const pollRes = await request(app)
        .post('/api/v1/docker/runner/jobs/poll')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ runnerId: 'windows-docker-runner' });

      expect(pollRes.status).toBe(200);
      expect(pollRes.body.data).not.toBeNull();
      expect(pollRes.body.data.jobType).toBe('MANAGEMENT');
      expect(pollRes.body.data.actionType).toBe('CONTAINER_START');
      expect(pollRes.body.data.params.containerId).toBe('custom-demo-container');

      // Runner completes the management job
      const completeRes = await request(app)
        .post(`/api/v1/docker/runner/jobs/${pollRes.body.data.id}/complete`)
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({
          runnerId: 'windows-docker-runner',
          success: true,
          data: { started: true },
        });

      expect(completeRes.status).toBe(200);

      // Await original action resolution
      const actionResult = await actionPromise;
      expect(actionResult.started).toBe(true);
    });
  });

  describe('8. Comprehensive Protected Resource Regression Suite', () => {
    const sampleInventory: DockerInventorySnapshot = {
      containers: [
        {
          id: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          name: 'smart_review_backend_api',
          image: 'smart-review-analytics-backend:latest',
          imageId: 'sha256:0a620eef77501234567890abcdef1234567890abcdef1234567890abcdef',
          status: 'Up 5 hours',
          state: 'running',
          created: '5 hours ago',
          ports: [{ hostPort: 5000, containerPort: 5000, protocol: 'tcp' }],
          isProtected: true,
        },
        {
          id: 'f4c1d2e3b4a567890123456789abcdef0123456789abcdef0123456789abcdef',
          name: 'smart_review_analytics_engine',
          image: 'smart-review-analytics-engine:v1',
          imageId: 'sha256:1b731ff088611234567890abcdef1234567890abcdef1234567890abcdef',
          status: 'Up 5 hours',
          state: 'running',
          created: '5 hours ago',
          ports: [{ hostPort: 5001, containerPort: 5001, protocol: 'tcp' }],
          isProtected: true,
        },
        {
          id: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef',
          name: 'jenkins',
          image: 'jenkins/jenkins:lts',
          imageId: 'sha256:2c842aa199721234567890abcdef1234567890abcdef1234567890abcdef',
          status: 'Up 10 hours',
          state: 'running',
          created: '10 hours ago',
          ports: [{ hostPort: 8080, containerPort: 8080, protocol: 'tcp' }],
          isProtected: true,
        },
        {
          id: 'd9e8f7a6b5c41111111111abcdef1234567890abcdef1234567890abcdef',
          name: 'user-app-one',
          image: 'my-custom-node-app:1.0',
          imageId: 'sha256:3d953bb2aa831234567890abcdef1234567890abcdef1234567890abcdef',
          status: 'Up 1 hour',
          state: 'running',
          created: '1 hour ago',
          ports: [{ hostPort: 3000, containerPort: 3000, protocol: 'tcp' }],
          isProtected: false,
        },
        {
          id: 'd9e8f7a6b5c42222222222abcdef1234567890abcdef1234567890abcdef',
          name: 'user-app-two',
          image: 'my-custom-node-app:2.0',
          imageId: 'sha256:4e064cc3bb941234567890abcdef1234567890abcdef1234567890abcdef',
          status: 'Exited (0)',
          state: 'exited',
          created: '2 hours ago',
          ports: [],
          isProtected: false,
        },
      ],
      images: [
        {
          id: 'sha256:0a620eef77501234567890abcdef1234567890abcdef1234567890abcdef',
          repository: 'smart-review-analytics-backend',
          tag: 'latest',
          size: '250MB',
          created: '2 days ago',
          inUseByContainers: ['smart_review_backend_api'],
          isProtected: true,
          isDangling: false,
        },
        {
          id: 'sha256:2c842aa199721234567890abcdef1234567890abcdef1234567890abcdef',
          repository: 'jenkins/jenkins',
          tag: 'lts',
          size: '450MB',
          created: '3 days ago',
          inUseByContainers: ['jenkins'],
          isProtected: true,
          isDangling: false,
        },
        {
          id: 'sha256:dangling00000000000000000000000000000000000000000000000000000000',
          repository: '<none>',
          tag: '<none>',
          size: '100MB',
          created: '4 days ago',
          inUseByContainers: ['smart_review_backend_api'],
          isProtected: true,
          isDangling: true,
        },
        {
          id: 'sha256:3d953bb2aa831234567890abcdef1234567890abcdef1234567890abcdef',
          repository: 'my-custom-node-app',
          tag: '1.0',
          size: '80MB',
          created: '1 day ago',
          inUseByContainers: ['user-app-one'],
          isProtected: false,
          isDangling: false,
        },
        {
          id: 'sha256:danglinguser99999999999999999999999999999999999999999999999999999',
          repository: '<none>',
          tag: '<none>',
          size: '50MB',
          created: '1 day ago',
          inUseByContainers: [],
          isProtected: false,
          isDangling: true,
        },
      ],
      networks: [
        {
          id: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
          name: 'bridge',
          driver: 'bridge',
          scope: 'local',
          containers: ['smart_review_backend_api'],
          isProtected: true,
        },
        {
          id: '222233334444555566667777888899990000aaaabbbbccccddddeeeeffff1111',
          name: 'smart-review-analytics_smart_review_network',
          driver: 'bridge',
          scope: 'local',
          containers: ['smart_review_analytics_engine'],
          isProtected: true,
        },
        {
          id: '33334444555566667777888899990000aaaabbbbccccddddeeeeffff22223333',
          name: 'user-network',
          driver: 'bridge',
          scope: 'local',
          containers: ['user-app-one'],
          isProtected: false,
        },
      ],
      volumes: [
        {
          name: 'jenkins_home',
          driver: 'local',
          inUseByContainers: ['jenkins'],
          isProtected: true,
        },
        {
          name: 'user_data_volume',
          driver: 'local',
          inUseByContainers: ['user-app-one'],
          isProtected: false,
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    it('rejects protected containers targeted by name, full ID, and short ID prefix', () => {
      // By name
      expect(() =>
        assertResourceNotProtected('container', 'smart_review_backend_api', 'STOP', sampleInventory)
      ).toThrow(/protected system container/);

      expect(() =>
        assertResourceNotProtected('container', 'jenkins', 'STOP', sampleInventory)
      ).toThrow(/protected system container/);

      // By full 64-character ID
      expect(() =>
        assertResourceNotProtected(
          'container',
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          'DELETE',
          sampleInventory
        )
      ).toThrow(/protected system container/);

      // By short ID prefix
      expect(() =>
        assertResourceNotProtected('container', 'e3b0c44298fc', 'STOP', sampleInventory)
      ).toThrow(/protected system container/);

      expect(() =>
        assertResourceNotProtected('container', 'a1b2c3d4e5f6', 'RESTART', sampleInventory)
      ).toThrow(/protected system container/);
    });

    it('rejects protected containers targeted through network disconnect', () => {
      // Network disconnect with protected container on user network
      expect(() =>
        assertNetworkDisconnectNotProtected('user-network', 'jenkins', 'NETWORK_DISCONNECT', sampleInventory)
      ).toThrow(/protected system container/);

      // Network disconnect with protected container ID prefix
      expect(() =>
        assertNetworkDisconnectNotProtected('user-network', 'e3b0c44298fc', 'NETWORK_DISCONNECT', sampleInventory)
      ).toThrow(/protected system container/);

      // Network disconnect targeting protected network
      expect(() =>
        assertNetworkDisconnectNotProtected('bridge', 'user-app-one', 'NETWORK_DISCONNECT', sampleInventory)
      ).toThrow(/protected system network/);
    });

    it('rejects protected containers targeted through recreate', () => {
      // Recreate existing protected container by name
      expect(() =>
        assertResourceNotProtected('container', 'jenkins', 'CONTAINER_RECREATE', sampleInventory)
      ).toThrow(/protected system container/);

      // Recreate existing protected container by ID prefix
      expect(() =>
        assertResourceNotProtected('container', 'a1b2c3d4e5f6', 'CONTAINER_RECREATE', sampleInventory)
      ).toThrow(/protected system container/);

      // Recreate user container but hijacking a protected container name
      expect(() =>
        assertResourceNotProtected('container', 'smart_review_backend_api', 'CONTAINER_RECREATE', sampleInventory)
      ).toThrow(/protected system container/);
    });

    it('rejects protected networks and volumes targeted by ID and prefix', () => {
      // Protected network by full ID
      expect(() =>
        assertResourceNotProtected(
          'network',
          '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
          'NETWORK_DELETE',
          sampleInventory
        )
      ).toThrow(/protected system network/);

      // Protected network by prefix
      expect(() =>
        assertResourceNotProtected('network', '111122223333', 'NETWORK_DELETE', sampleInventory)
      ).toThrow(/protected system network/);

      // Protected network by name
      expect(() =>
        assertResourceNotProtected(
          'network',
          'smart-review-analytics_smart_review_network',
          'NETWORK_DELETE',
          sampleInventory
        )
      ).toThrow(/protected system network/);

      // Protected volume by name
      expect(() =>
        assertResourceNotProtected('volume', 'jenkins_home', 'VOLUME_DELETE', sampleInventory)
      ).toThrow(/protected system volume/);
    });

    it('rejects protected images targeted by tag, digest, and image ID', () => {
      // By tag
      expect(() =>
        assertResourceNotProtected('image', 'jenkins/jenkins:lts', 'IMAGE_DELETE', sampleInventory)
      ).toThrow(/protected system image/);

      // By digest
      expect(() =>
        assertResourceNotProtected(
          'image',
          'jenkins/jenkins@sha256:2c842aa199721234567890abcdef1234567890abcdef1234567890abcdef',
          'IMAGE_DELETE',
          sampleInventory
        )
      ).toThrow(/protected system image/);

      // By full image ID
      expect(() =>
        assertResourceNotProtected(
          'image',
          'sha256:0a620eef77501234567890abcdef1234567890abcdef1234567890abcdef',
          'IMAGE_DELETE',
          sampleInventory
        )
      ).toThrow(/protected system image/);

      // By image ID prefix
      expect(() =>
        assertResourceNotProtected('image', '0a620eef7750', 'IMAGE_DELETE', sampleInventory)
      ).toThrow(/protected system image/);

      // Protected family repository
      expect(() =>
        assertResourceNotProtected('image', 'smart-review-analytics-backend:latest', 'IMAGE_DELETE', sampleInventory)
      ).toThrow(/protected system image/);
    });

    it('rejects dangling-image pruning when protected images or containers are affected', () => {
      // Dangling image in use by smart_review_backend_api
      expect(() =>
        assertImagePruneNotProtected('IMAGE_PRUNE_DANGLING', sampleInventory)
      ).toThrow(/dangling image prune would affect protected resource/);

      // Clean inventory without protected dangling images succeeds
      const safeInventory: DockerInventorySnapshot = {
        ...sampleInventory,
        images: sampleInventory.images.filter(
          (img) => !img.isDangling || img.id.includes('danglinguser')
        ),
      };
      expect(() =>
        assertImagePruneNotProtected('IMAGE_PRUNE_DANGLING', safeInventory)
      ).not.toThrow();
    });

    it('rejects ambiguous identifiers and inventory lookup failures', () => {
      // Ambiguous container ID prefix 'd9e8f7a6b5c4' matching both user-app-one and user-app-two
      expect(() =>
        assertResourceNotProtected('container', 'd9e8f7a6b5c4', 'STOP', sampleInventory)
      ).toThrow(/Ambiguous container identifier/);

      // Non-existent target not found in inventory
      expect(() =>
        assertResourceNotProtected('container', 'nonexistent-uuid-12345', 'STOP', sampleInventory)
      ).toThrow(/cannot be resolved reliably in Docker inventory/);
    });

    it('allows ordinary user-created resources to be managed', () => {
      // User container stop & delete
      expect(() =>
        assertResourceNotProtected('container', 'user-app-one', 'STOP', sampleInventory)
      ).not.toThrow();

      // User container by ID prefix
      expect(() =>
        assertResourceNotProtected('container', 'd9e8f7a6b5c41111', 'DELETE', sampleInventory)
      ).not.toThrow();

      // User network delete & disconnect
      expect(() =>
        assertResourceNotProtected('network', 'user-network', 'NETWORK_DELETE', sampleInventory)
      ).not.toThrow();

      expect(() =>
        assertNetworkDisconnectNotProtected('user-network', 'user-app-one', 'NETWORK_DISCONNECT', sampleInventory)
      ).not.toThrow();

      // User volume delete
      expect(() =>
        assertResourceNotProtected('volume', 'user_data_volume', 'VOLUME_DELETE', sampleInventory)
      ).not.toThrow();

      // User image delete
      expect(() =>
        assertResourceNotProtected('image', 'my-custom-node-app:1.0', 'IMAGE_DELETE', sampleInventory)
      ).not.toThrow();
    });
  });
});
