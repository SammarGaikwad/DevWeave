import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../config/database.js';

describe('Authentication & RBAC Integration Tests', () => {
  beforeAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { email: { in: ['testuser@example.com', 'adminuser@example.com'] } },
      });
    } catch (e) {
      console.warn('⚠️ Test DB notice: Local PostgreSQL is offline or unreachable.', e);
    }
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { email: { in: ['testuser@example.com', 'adminuser@example.com'] } },
      });
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors
    }
  });

  const testUser = {
    name: 'Test Developer',
    email: 'testuser@example.com',
    password: 'password123',
  };

  let accessToken: string;
  let refreshCookie: string;

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a new developer account', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.role).toBe('DEVELOPER');
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should reject registration with duplicate email with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Invalid Email', email: 'notanemail', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject registration with short password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Short Pass', email: 'short@example.com', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should reject login with wrong password with generic error', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password.');
    });

    it('should login successfully with valid credentials and return access token + HttpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email);

      accessToken = res.body.data.accessToken;

      const cookies = res.get('Set-Cookie');
      expect(cookies).toBeDefined();
      refreshCookie = (cookies && cookies[0]) || '';
    });
  });

  describe('GET /api/v1/users/me', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(401);
    });

    it('should return user profile for valid bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testUser.email);
    });
  });

  describe('RBAC Authorization', () => {
    it('should deny DEVELOPER user access to ADMIN endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('permission');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should rotate refresh token and issue new access token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      const newCookies = res.get('Set-Cookie');
      expect(newCookies).toBeDefined();
      refreshCookie = (newCookies && newCookies[0]) || '';
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout and clear refresh cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', refreshCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const resAfterLogout = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie);

      expect(resAfterLogout.status).toBe(401);
    });
  });
});
