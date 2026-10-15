import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';

describe('System Monitoring & Logs API Tests', () => {
  const token = generateAccessToken({ sub: 'monitoring-test-user', role: 'DEVELOPER' });

  describe('GET /api/v1/monitoring/health', () => {
    it('should return system monitoring snapshot with real memory, uptime, and service health', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/health')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(['HEALTHY', 'DEGRADED', 'CRITICAL']).toContain(res.body.data.overallStatus);
      expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(res.body.data.memoryUsageMb.heapUsed).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data.services)).toBe(true);
      expect(res.body.data.services.length).toBe(4);

      const apiService = res.body.data.services.find((s: { name: string }) => s.name.includes('Backend API'));
      expect(apiService).toBeDefined();
      expect(apiService.status).toBe('HEALTHY');
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/monitoring/health');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/monitoring/logs', () => {
    it('should return platform and pipeline logs', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/logs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const firstLog = res.body.data[0];
      expect(firstLog.id).toBeDefined();
      expect(firstLog.timestamp).toBeDefined();
      expect(['INFO', 'WARN', 'ERROR']).toContain(firstLog.level);
    });
  });
});
