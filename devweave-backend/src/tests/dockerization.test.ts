import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import {
  analyzeProjectFiles,
  type ProjectFileEntry,
} from '../services/dockerAnalysisService.js';
import { generateDockerConfig } from '../services/dockerGeneratorService.js';
import {
  createBuildJob,
  leaseNextQueuedJob,
  appendJobLogs,
  completeBuildJob,
  cancelBuildJob,
  sanitizeLogMessage,
} from '../services/dockerBuildJobService.js';
import { generateAccessToken } from '../utils/jwt.js';
import { env } from '../config/env.js';

describe('One-Click Dockerization Platform Tests', () => {
  const authToken = generateAccessToken({ sub: 'test-user-docker-123', role: 'DEVELOPER' });

  describe('Project Detection & Analysis', () => {
    it('detects React / Vite frontend projects correctly', () => {
      const files: ProjectFileEntry[] = [
        {
          path: 'package.json',
          type: 'file',
          content: JSON.stringify({
            name: 'my-vite-app',
            dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
            devDependencies: { vite: '^5.0.0', '@vitejs/plugin-react': '^4.0.0' },
            scripts: { build: 'vite build', preview: 'vite preview' },
          }),
        },
        { path: 'vite.config.ts', type: 'file' },
      ];

      const stack = analyzeProjectFiles(files);
      expect(stack.framework).toBe('React / Vite');
      expect(stack.projectType).toBe('frontend');
      expect(stack.defaultPort).toBe(80);
      expect(stack.buildCommand).toBe('npm run build');
      expect(stack.confidence).toBe('high');
    });

    it('detects Next.js full-stack projects correctly', () => {
      const files: ProjectFileEntry[] = [
        {
          path: 'package.json',
          type: 'file',
          content: JSON.stringify({
            name: 'my-next-app',
            dependencies: { next: '^14.0.0', react: '^18.2.0' },
            scripts: { build: 'next build', start: 'next start' },
          }),
        },
        { path: 'next.config.js', type: 'file' },
      ];

      const stack = analyzeProjectFiles(files);
      expect(stack.framework).toBe('Next.js');
      expect(stack.projectType).toBe('fullstack');
      expect(stack.defaultPort).toBe(3000);
      expect(stack.confidence).toBe('high');
    });

    it('detects Express.js TypeScript APIs correctly', () => {
      const files: ProjectFileEntry[] = [
        {
          path: 'package.json',
          type: 'file',
          content: JSON.stringify({
            name: 'express-api',
            dependencies: { express: '^4.19.0' },
            devDependencies: { typescript: '^5.0.0' },
            scripts: { build: 'tsc', start: 'node dist/server.js' },
          }),
        },
        { path: 'tsconfig.json', type: 'file' },
      ];

      const stack = analyzeProjectFiles(files);
      expect(stack.framework).toBe('Express.js (TypeScript)');
      expect(stack.projectType).toBe('backend');
      expect(stack.defaultPort).toBe(8080);
    });

    it('detects Python FastAPI applications correctly', () => {
      const files: ProjectFileEntry[] = [
        {
          path: 'requirements.txt',
          type: 'file',
          content: 'fastapi==0.109.0\nuvicorn==0.27.0\npydantic==2.6.0',
        },
        { path: 'main.py', type: 'file' },
      ];

      const stack = analyzeProjectFiles(files);
      expect(stack.language).toBe('Python');
      expect(stack.framework).toBe('FastAPI');
      expect(stack.defaultPort).toBe(8000);
      expect(stack.startCommand).toContain('uvicorn main:app');
    });

    it('detects Java Spring Boot Maven applications correctly', () => {
      const files: ProjectFileEntry[] = [
        {
          path: 'pom.xml',
          type: 'file',
          content: '<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>',
        },
      ];

      const stack = analyzeProjectFiles(files);
      expect(stack.language).toBe('Java');
      expect(stack.framework).toBe('Spring Boot');
      expect(stack.packageManager).toBe('Maven');
      expect(stack.defaultPort).toBe(8080);
    });

    it('detects full-stack repositories with frontend and backend subdirectories', () => {
      const files: ProjectFileEntry[] = [
        { path: 'frontend/package.json', type: 'file' },
        { path: 'backend/package.json', type: 'file' },
      ];

      const stack = analyzeProjectFiles(files);
      expect(stack.projectType).toBe('fullstack');
      expect(stack.subprojects?.length).toBe(2);
      expect(stack.confidence).toBe('high');
    });

    it('detects existing Dockerfile and flags it in stack analysis', () => {
      const files: ProjectFileEntry[] = [
        {
          path: 'Dockerfile',
          type: 'file',
          content: 'FROM node:18-alpine\nCMD ["node", "app.js"]',
        },
      ];

      const stack = analyzeProjectFiles(files);
      expect(stack.existingDockerfile).toBeDefined();
      expect(stack.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Docker Configuration Generation & Security', () => {
    it('generates multi-stage Dockerfile and .dockerignore for React/Vite with Nginx', () => {
      const stack = analyzeProjectFiles([
        {
          path: 'package.json',
          type: 'file',
          content: JSON.stringify({
            dependencies: { react: '^18.0.0' },
            devDependencies: { vite: '^5.0.0' },
            scripts: { build: 'vite build' },
          }),
        },
      ]);

      const config = generateDockerConfig(stack);
      expect(config.dockerfile).toContain('FROM node:20-alpine AS builder');
      expect(config.dockerfile).toContain('FROM nginx:alpine AS runner');
      expect(config.dockerfile).toContain('EXPOSE 80');
      expect(config.dockerignore).toContain('.git');
      expect(config.dockerignore).toContain('.env');
      expect(config.dockerignore).toContain('node_modules');
    });

    it('generates non-root user configuration for Next.js standalone', () => {
      const stack = analyzeProjectFiles([
        {
          path: 'package.json',
          type: 'file',
          content: JSON.stringify({ dependencies: { next: '^14.0.0' } }),
        },
      ]);

      const config = generateDockerConfig(stack);
      expect(config.dockerfile).toContain('adduser --system --uid 1001 nextjs');
      expect(config.dockerfile).toContain('USER nextjs');
      expect(config.dockerfile).toContain('EXPOSE 3000');
    });

    it('generates Docker Compose configuration for full-stack architecture', () => {
      const stack = analyzeProjectFiles([
        { path: 'client/package.json', type: 'file' },
        { path: 'server/package.json', type: 'file' },
      ]);

      const config = generateDockerConfig(stack);
      expect(config.composeFile).toBeDefined();
      expect(config.composeFile).toContain('services:');
      expect(config.composeFile).toContain('backend:');
      expect(config.composeFile).toContain('frontend:');
    });

    it('creates diff against existing Dockerfile when present', () => {
      const existing = 'FROM node:16\nWORKDIR /app\nCOPY . .\nCMD ["node", "index.js"]';
      const stack = analyzeProjectFiles([
        { path: 'Dockerfile', type: 'file', content: existing },
        { path: 'package.json', type: 'file', content: JSON.stringify({ dependencies: { express: '^4.18.0' } }) },
      ]);

      const config = generateDockerConfig(stack);
      expect(config.diffs?.dockerfileDiff).toBeDefined();
      expect(config.diffs?.dockerfileDiff).toContain('--- Existing Dockerfile');
      expect(config.diffs?.dockerfileDiff).toContain('+++ DevWeave Generated Dockerfile');
    });
  });

  describe('Build Job Lifecycle, Lease, and Log Sanitization', () => {
    it('sanitizes tokens, Bearer strings, and host paths from logs', () => {
      const rawMsg =
        'Authorization: Bearer my_secret_token_abc123. Cloned into C:\\Users\\Administrator\\AppData\\Local\\Temp\\build';
      const sanitized = sanitizeLogMessage(rawMsg);

      expect(sanitized).not.toContain('my_secret_token_abc123');
      expect(sanitized).not.toContain('Administrator');
      expect(sanitized).toContain('Bearer ********');
      expect(sanitized).toContain('C:\\Users\\***');
    });

    it('manages full job lifecycle: QUEUED -> BUILDING -> SUCCEEDED', () => {
      const job = createBuildJob({
        userId: 'test-user-1',
        repoFullName: 'octocat/Hello-World',
        branch: 'main',
        imageTag: 'hello-world:v1.0.0',
        dockerfile: 'FROM alpine\nCMD ["echo", "hello"]',
      });

      expect(job.status).toBe('QUEUED');
      expect(job.id).toMatch(/^build_/);

      // Runner claims job
      const leased = leaseNextQueuedJob('windows-docker-runner');
      expect(leased?.id).toBe(job.id);
      expect(leased?.status).toBe('BUILDING');
      expect(leased?.leaseExpiresAt).toBeGreaterThan(Date.now());

      // Append logs
      const logRes = appendJobLogs(job.id, 'windows-docker-runner', [
        { stage: 'build', severity: 'info', message: 'Step 1/2 : FROM alpine' },
        { stage: 'build', severity: 'info', message: 'Step 2/2 : CMD ["echo", "hello"]' },
      ]);
      expect(logRes.cancelRequested).toBe(false);

      // Complete job
      const completed = completeBuildJob(job.id, 'windows-docker-runner', {
        success: true,
        imageId: 'a1b2c3d4e5f6',
        imageSize: '15.42 MB',
        durationMs: 4200,
      });

      expect(completed.status).toBe('SUCCEEDED');
      expect(completed.imageId).toBe('a1b2c3d4e5f6');
      expect(completed.imageSize).toBe('15.42 MB');
      expect(completed.durationMs).toBe(4200);
    });

    it('prevents duplicate active build submissions for the same repository and branch', () => {
      const repoFullName = 'org/duplicate-test';
      const branch = 'main';

      createBuildJob({
        userId: 'test-user-dup',
        repoFullName,
        branch,
        imageTag: 'dup-test:v1',
        dockerfile: 'FROM alpine',
      });

      expect(() =>
        createBuildJob({
          userId: 'test-user-dup',
          repoFullName,
          branch,
          imageTag: 'dup-test:v2',
          dockerfile: 'FROM alpine',
        })
      ).toThrow(/already in progress/);
    });

    it('rejects invalid image tags', () => {
      expect(() =>
        createBuildJob({
          userId: 'test-user-tag',
          repoFullName: 'org/repo',
          branch: 'main',
          imageTag: 'invalid tag with spaces',
          dockerfile: 'FROM alpine',
        })
      ).toThrow(/Invalid Docker image tag format/);
    });

    it('handles user cancellation of running jobs gracefully', () => {
      const job = createBuildJob({
        userId: 'test-user-cancel',
        repoFullName: 'org/cancel-repo',
        branch: 'main',
        imageTag: 'cancel-image:v1',
        dockerfile: 'FROM alpine',
      });

      const cancelled = cancelBuildJob(job.id, 'test-user-cancel');
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelRequested).toBe(true);
    });
  });

  describe('HTTP API Endpoints for Dockerization', () => {
    it('requires authentication for /api/v1/docker/analyze', async () => {
      const res = await request(app).post('/api/v1/docker/analyze').send({});
      expect(res.status).toBe(401);
    });

    it('requires authentication for /api/v1/docker/generate-config', async () => {
      const res = await request(app).post('/api/v1/docker/generate-config').send({});
      expect(res.status).toBe(401);
    });

    it('generates config via POST /api/v1/docker/generate-config when authenticated', async () => {
      const stack = {
        language: 'TypeScript',
        framework: 'Express.js (TypeScript)',
        projectType: 'backend',
        packageManager: 'npm',
        startCommand: 'node dist/server.js',
        defaultPort: 8080,
        envVars: ['PORT'],
        isMonorepo: false,
        confidence: 'high',
        warnings: [],
        assumptions: [],
      };

      const res = await request(app)
        .post('/api/v1/docker/generate-config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stack });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dockerfile).toContain('EXPOSE 8080');
      expect(res.body.data.dockerignore).toContain('node_modules');
    });

    it('creates, inspects, and lists build jobs via API', async () => {
      // 1. Create job
      const createRes = await request(app)
        .post('/api/v1/docker/builds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          repoFullName: 'test-owner/test-api',
          branch: 'feature-docker',
          imageTag: 'test-api:feature-docker',
          dockerfile: 'FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nCMD ["node", "app.js"]',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      const jobId = createRes.body.data.id;
      expect(jobId).toBeDefined();

      // 2. Get job status
      const getRes = await request(app)
        .get(`/api/v1/docker/builds/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(jobId);
      expect(getRes.body.data.status).toBe('QUEUED');

      // 3. Get job logs
      const logsRes = await request(app)
        .get(`/api/v1/docker/builds/${jobId}/logs`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(logsRes.status).toBe(200);
      expect(logsRes.body.data.logs.length).toBeGreaterThan(0);

      // 4. List user jobs
      const listRes = await request(app)
        .get('/api/v1/docker/builds')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data)).toBe(true);
      const found = listRes.body.data.some((j: any) => j.id === jobId);
      expect(found).toBe(true);
    });

    it('runner polls for queued jobs with runner authentication', async () => {
      const runnerToken = env.DOCKER_RUNNER_TOKEN;

      const pollRes = await request(app)
        .post('/api/v1/docker/runner/jobs/poll')
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ runnerId: 'windows-docker-runner' });

      expect(pollRes.status).toBe(200);
      expect(pollRes.body.success).toBe(true);
      // Either receives a leased job payload or null if queue empty
      if (pollRes.body.data) {
        expect(pollRes.body.data.id).toBeDefined();
        expect(pollRes.body.data.imageTag).toBeDefined();
        expect(pollRes.body.data.dockerfile).toBeDefined();
      }
    });
  });
});
