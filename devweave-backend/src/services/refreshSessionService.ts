import crypto from 'crypto';
import * as refreshSessionRepo from '../repositories/refreshSessionRepository.js';
import { generateRefreshToken, verifyRefreshToken, RefreshTokenPayload } from '../utils/jwt.js';
import { AppError } from '../middleware/errorHandler.js';

const REFRESH_EXPIRATION_DAYS = 7;

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function createSession(userId: string): Promise<{ sessionId: string; rawToken: string }> {
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

  // 1. Create a dummy session record to obtain the generated UUID sessionId
  const session = await refreshSessionRepo.createRefreshSession({
    userId,
    tokenHash: 'pending',
    expiresAt,
  });

  // 2. Sign JWT refresh token with sub (userId) and sessionId
  const rawToken = generateRefreshToken({
    sub: userId,
    sessionId: session.id,
  });

  // 3. Store SHA-256 hash of the raw refresh token
  const tokenHash = hashToken(rawToken);
  await refreshSessionRepo.updateRefreshSessionToken(session.id, tokenHash, expiresAt);

  return { sessionId: session.id, rawToken };
}

export async function validateAndRotateSession(
  rawRefreshToken: string
): Promise<{ userId: string; newRawToken: string }> {
  let payload: RefreshTokenPayload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const session = await refreshSessionRepo.findRefreshSessionById(payload.sessionId);
  if (!session) {
    throw new AppError('Refresh session not found', 401);
  }

  if (session.revokedAt) {
    throw new AppError('Refresh session has been revoked', 401);
  }

  if (new Date() > session.expiresAt) {
    throw new AppError('Refresh session has expired', 401);
  }

  const expectedHash = hashToken(rawRefreshToken);
  if (session.tokenHash !== expectedHash) {
    // Possible token reuse attack detected! Revoke the session.
    await refreshSessionRepo.revokeRefreshSession(session.id);
    throw new AppError('Invalid refresh token credential', 401);
  }

  // Revoke old session (token rotation)
  await refreshSessionRepo.revokeRefreshSession(session.id);

  // Create brand new refresh session
  const newSession = await createSession(session.userId);

  return {
    userId: session.userId,
    newRawToken: newSession.rawToken,
  };
}

export async function revokeSessionByToken(rawRefreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(rawRefreshToken);
    await refreshSessionRepo.revokeRefreshSession(payload.sessionId);
  } catch {
    // Ignore invalid/expired tokens during logout
  }
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await refreshSessionRepo.revokeAllRefreshSessionsForUser(userId);
}
