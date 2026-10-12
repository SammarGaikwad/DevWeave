import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';
import { Role } from '../generated/prisma/client.js';
import * as repoRepo from '../repositories/repositoryRepository.js';
import * as pipelineRepo from '../repositories/pipelineRepository.js';

describe('Predefined Pipeline Templates & CI/CD System Tests', () => {
  const dummyUserId = '00000000-0000-0000-0000-000000000001';
  const testToken = generateAccessToken({ sub: dummyUserId, role: Role.DEVELOPER });

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // 1. Template Listing & Metadata
  describe('GET /api/v1/pipeline-templates', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/pipeline-templates');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return all 4 predefined templates with complete stages and metadata', async () => {
      const res = await request(app)
        .get('/api/v1/pipeline-templates')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(4);

      const templateIds = res.body.data.map((t: any) => t.id);
      expect(templateIds).toContain('nodejs-backend-ci');
      expect(templateIds).toContain('react-frontend-ci');
      expect(templateIds).toContain('docker-build');
      expect(templateIds).toContain('fullstack-ci-cd');

      // Verify Template A stages
      const nodeTemplate = res.body.data.find((t: any) => t.id === 'nodejs-backend-ci');
      expect(nodeTemplate.stages.map((s: any) => s.name)).toEqual([
        'Checkout Repository',
        'Validate Node.js Version',
        'Install Dependencies',
        'Run Linting, If Configured',
        'Run Tests, If Configured',
        'Build Backend',
        'Publish Build Result',
      ]);

      // Verify Template B stages
      const reactTemplate = res.body.data.find((t: any) => t.id === 'react-frontend-ci');
      expect(reactTemplate.stages.map((s: any) => s.name)).toEqual([
        'Checkout Repository',
        'Validate Node.js Version',
        'Install Dependencies',
        'Run Type Checking',
        'Run Tests, If Configured',
        'Build Frontend',
        'Publish Build Result',
      ]);

      // Verify Template C stages
      const dockerTemplate = res.body.data.find((t: any) => t.id === 'docker-build');
      expect(dockerTemplate.stages.map((s: any) => s.name)).toEqual([
        'Checkout Repository',
        'Validate Docker Configuration',
        'Build Docker Image',
        'Validate Image Build',
        'Publish Build Result',
      ]);

      // Verify Template D stages
      const fullstackTemplate = res.body.data.find((t: any) => t.id === 'fullstack-ci-cd');
      expect(fullstackTemplate.stages.map((s: any) => s.name)).toEqual([
        'Checkout Repository',
        'Install Dependencies',
        'Run Available Tests',
        'Build Frontend',
        'Build Backend',
        'Validate Build Artifacts',
        'Publish Build Result',
      ]);
    });

    it('should return 400 for unknown template ID', async () => {
      const res = await request(app)
        .get('/api/v1/pipeline-templates/unknown-template-xyz')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Unsupported pipeline template');
    });
  });

  // 2. Repository Authorization & Pipeline Configuration
  describe('POST /api/v1/repositories/:repositoryId/pipelines', () => {
    it('should return 404 if repository does not exist', async () => {
      vi.spyOn(repoRepo, 'findRepositoryById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/repositories/non-existent-repo-id/pipelines')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          templateId: 'nodejs-backend-ci',
          branch: 'main',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 if repository belongs to another user', async () => {
      vi.spyOn(repoRepo, 'findRepositoryById').mockResolvedValue({
        id: 'repo-other-user',
        name: 'secret-repo',
        fullName: 'other/secret-repo',
        userId: 'other-user-999',
      } as any);

      const res = await request(app)
        .post('/api/v1/repositories/repo-other-user/pipelines')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          templateId: 'nodejs-backend-ci',
          branch: 'main',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Unauthorized');
    });

    it('should reject invalid branch names with malicious characters', async () => {
      vi.spyOn(repoRepo, 'findRepositoryById').mockResolvedValue({
        id: 'repo-1',
        name: 'my-app',
        fullName: 'my-org/my-app',
        userId: dummyUserId,
      } as any);

      const res = await request(app)
        .post('/api/v1/repositories/repo-1/pipelines')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          templateId: 'nodejs-backend-ci',
          branch: 'main; rm -rf /',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid branch name');
    });

    it('should successfully configure repository pipeline and create Jenkins job', async () => {
      vi.spyOn(repoRepo, 'findRepositoryById').mockResolvedValue({
        id: 'repo-1',
        name: 'my-app',
        fullName: 'my-org/my-app',
        userId: dummyUserId,
        defaultBranch: 'main',
      } as any);

      // Mock Jenkins job check & creation
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/crumbIssuer/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ crumbRequestField: 'Jenkins-Crumb', crumb: 'test-crumb' }),
          } as Response;
        }
        if (url.includes('/api/json')) {
          return { ok: false, status: 404 } as Response; // job does not exist yet
        }
        if (url.includes('/createItem')) {
          return { ok: true, status: 200 } as Response; // created job
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      });

      const res = await request(app)
        .post('/api/v1/repositories/repo-1/pipelines')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          templateId: 'nodejs-backend-ci',
          branch: 'main',
          config: {
            buildCommand: 'npm run build',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.templateId).toBe('nodejs-backend-ci');
      expect(res.body.data.jenkinsJobName).toContain('devweave-my-app-nodejs-backend-ci');
    });
  });

  // 3. Execution, Queue Item Handling, and Stage Mapping
  describe('Pipeline Execution & Status Synchronization', () => {
    it('should trigger pipeline run, record queue item, and initialize stages', async () => {
      const mockPipeline = {
        id: 'pipe-100',
        repositoryId: 'repo-1',
        userId: dummyUserId,
        templateId: 'nodejs-backend-ci',
        branch: 'main',
        jenkinsJobName: 'devweave-my-app-nodejs-backend-ci',
      };

      vi.spyOn(repoRepo, 'findRepositoryById').mockResolvedValue({
        id: 'repo-1',
        name: 'my-app',
        fullName: 'my-org/my-app',
        userId: dummyUserId,
      } as any);
      vi.spyOn(pipelineRepo, 'findPipelineById').mockResolvedValue(mockPipeline as any);

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/crumbIssuer/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ crumbRequestField: 'Jenkins-Crumb', crumb: 'test-crumb' }),
          } as Response;
        }
        if (url.includes('/build')) {
          return {
            ok: true,
            status: 201,
            headers: new Headers({
              location: 'http://98.70.58.149:8080/queue/item/77/',
            }),
          } as Response;
        }
        return { ok: true, status: 200 } as Response;
      });

      const res = await request(app)
        .post('/api/v1/pipelines/pipe-100/runs')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('QUEUED');
      expect(res.body.data.jenkinsQueueItemId).toBe(77);
      expect(res.body.data.stageRuns).toHaveLength(7);
      expect(res.body.data.stageRuns[0].status).toBe('PENDING');
    });

    it('should resolve build number and map real Jenkins wfapi stages to stage runs', async () => {
      const runId = 'run-200';
      const mockRun = {
        id: runId,
        pipelineId: 'pipe-100',
        repositoryId: 'repo-1',
        userId: dummyUserId,
        templateId: 'nodejs-backend-ci',
        branch: 'main',
        jenkinsJobName: 'devweave-my-app-nodejs-backend-ci',
        jenkinsQueueItemId: 77,
        jenkinsBuildNumber: null,
        status: 'QUEUED',
        stageRuns: [
          { id: 'stg-1', name: 'Checkout Repository', order: 1, status: 'PENDING', durationMs: 0 },
          { id: 'stg-2', name: 'Validate Node.js Version', order: 2, status: 'PENDING', durationMs: 0 },
          { id: 'stg-3', name: 'Install Dependencies', order: 3, status: 'PENDING', durationMs: 0 },
          { id: 'stg-4', name: 'Run Linting, If Configured', order: 4, status: 'PENDING', durationMs: 0 },
          { id: 'stg-5', name: 'Run Tests, If Configured', order: 5, status: 'PENDING', durationMs: 0 },
          { id: 'stg-6', name: 'Build Backend', order: 6, status: 'PENDING', durationMs: 0 },
          { id: 'stg-7', name: 'Publish Build Result', order: 7, status: 'PENDING', durationMs: 0 },
        ],
      };

      vi.spyOn(repoRepo, 'findRepositoryById').mockResolvedValue({
        id: 'repo-1',
        userId: dummyUserId,
      } as any);
      vi.spyOn(pipelineRepo, 'findPipelineRunById').mockResolvedValue(mockRun as any);

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/queue/item/77/api/json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              executable: { number: 15, url: 'http://jenkins/job/test/15/' },
            }),
          } as Response;
        }
        if (url.includes('/15/api/json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              number: 15,
              url: 'http://jenkins/job/test/15/',
              timestamp: Date.now(),
              duration: 35000,
              result: 'SUCCESS',
              building: false,
            }),
          } as Response;
        }
        if (url.includes('/15/wfapi/describe')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              stages: [
                { id: '1', name: 'Checkout Repository', status: 'SUCCESS', durationMillis: 2100 },
                { id: '2', name: 'Validate Node.js Version', status: 'SUCCESS', durationMillis: 800 },
                { id: '3', name: 'Install Dependencies', status: 'SUCCESS', durationMillis: 14000 },
                { id: '4', name: 'Run Linting, If Configured', status: 'SUCCESS', durationMillis: 3500 },
                { id: '5', name: 'Run Tests, If Configured', status: 'SUCCESS', durationMillis: 5000 },
                { id: '6', name: 'Build Backend', status: 'SUCCESS', durationMillis: 9000 },
                { id: '7', name: 'Publish Build Result', status: 'SUCCESS', durationMillis: 400 },
              ],
            }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      });

      const res = await request(app)
        .get(`/api/v1/pipeline-runs/${runId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(runId);
    });

    it('should fetch and sanitize console build logs', async () => {
      const runId = 'run-300';
      const mockRun = {
        id: runId,
        repositoryId: 'repo-1',
        userId: dummyUserId,
        jenkinsJobName: 'devweave-my-app-nodejs-backend-ci',
        jenkinsBuildNumber: 15,
        status: 'SUCCESS',
      };

      vi.spyOn(repoRepo, 'findRepositoryById').mockResolvedValue({
        id: 'repo-1',
        userId: dummyUserId,
      } as any);
      vi.spyOn(pipelineRepo, 'findPipelineRunById').mockResolvedValue(mockRun as any);

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/consoleText')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              'Started by DevWeave\nCloning https://x-access-token:ghp_1234567890abcdef1234567890abcdef1234@github.com/my-org/my-app.git\nFinished: SUCCESS',
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const res = await request(app)
        .get(`/api/v1/pipeline-runs/${runId}/logs`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs).toContain('Finished: SUCCESS');
      // Token must be sanitized
      expect(res.body.data.logs).not.toContain('ghp_1234567890abcdef1234567890abcdef1234');
      expect(res.body.data.logs).toContain('[REDACTED]');
    });
  });
});
