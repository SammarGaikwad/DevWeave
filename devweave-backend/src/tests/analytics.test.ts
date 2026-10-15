import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';

describe('Platform Analytics API Tests', () => {
  const token = generateAccessToken({ sub: 'analytics-test-user', role: 'DEVELOPER' });

  describe('GET /api/v1/analytics/overview', () => {
    it('should calculate and return pipeline run analytics and duration metrics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.isDemoFallback).toBe('boolean');
      expect(typeof res.body.data.totalRuns).toBe('number');
      expect(typeof res.body.data.successRate).toBe('number');
      expect(typeof res.body.data.durationMetrics.avgDurationSec).toBe('number');
      expect(Array.isArray(res.body.data.dailyActivity)).toBe(true);
      expect(res.body.data.dailyActivity.length).toBe(7);
      expect(Array.isArray(res.body.data.stageFailureHotspots)).toBe(true);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/analytics/overview');
      expect(res.status).toBe(401);
    });
  });
});
