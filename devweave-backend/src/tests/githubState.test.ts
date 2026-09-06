import { describe, it, expect, beforeEach } from 'vitest';
import {
  createOAuthState,
  verifyState,
  buildAuthorizationUrl,
  clearOAuthStateStore,
} from '../services/githubService.js';
import { AppError } from '../middleware/errorHandler.js';

describe('GitHub OAuth State Security', () => {
  beforeEach(() => {
    clearOAuthStateStore();
  });

  it('should generate a valid OAuth state token for a user', () => {
    const userId = 'user-12345';
    const stateToken = createOAuthState(userId);

    expect(stateToken).toBeDefined();
    expect(stateToken).toContain('devweave_state_');

    const verifiedUserId = verifyState(stateToken);
    expect(verifiedUserId).toBe(userId);
  });

  it('should enforce single-use state tokens and reject replayed tokens', () => {
    const userId = 'user-12345';
    const stateToken = createOAuthState(userId);

    // First verification succeeds
    const verifiedUserId = verifyState(stateToken);
    expect(verifiedUserId).toBe(userId);

    // Second verification must fail (single-use token purged)
    expect(() => verifyState(stateToken)).toThrowError(AppError);
    expect(() => verifyState(stateToken)).toThrowError('Invalid or expired OAuth state');
  });

  it('should reject invalid or tampered state tokens', () => {
    expect(() => verifyState('invalid_token_xyz')).toThrowError(AppError);
    expect(() => verifyState('invalid_token_xyz')).toThrowError('Invalid or expired OAuth state');
  });

  it('should include state token in authorization URL', () => {
    const userId = 'user-999';
    const authUrl = buildAuthorizationUrl(userId);

    expect(authUrl).toContain('https://github.com/login/oauth/authorize');
    expect(authUrl).toContain('client_id=');
    expect(authUrl).toContain('redirect_uri=');
    expect(authUrl).toContain('state=devweave_state_');
  });
});
