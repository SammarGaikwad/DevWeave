import { RefreshSession } from '../generated/prisma/client.js';
import { prisma, isDbAvailable, markDbOffline } from '../config/database.js';
import crypto from 'crypto';

const memorySessions = new Map<string, RefreshSession>();

export async function createRefreshSession(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<RefreshSession> {
  if (await isDbAvailable()) {
    try {
      const session = await prisma.refreshSession.create({
        data: {
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
        },
      });
      memorySessions.set(session.id, session);
      return session;
    } catch {
      markDbOffline();
    }
  }

  const newSession: RefreshSession = {
    id: crypto.randomUUID(),
    userId: data.userId,
    tokenHash: data.tokenHash,
    expiresAt: data.expiresAt,
    createdAt: new Date(),
    revokedAt: null,
  };
  memorySessions.set(newSession.id, newSession);
  return newSession;
}

export async function findRefreshSessionById(id: string): Promise<RefreshSession | null> {
  if (await isDbAvailable()) {
    try {
      const session = await prisma.refreshSession.findUnique({
        where: { id },
      });
      if (session) {
        memorySessions.set(session.id, session);
      }
      return session;
    } catch {
      markDbOffline();
    }
  }

  return memorySessions.get(id) || null;
}

export async function updateRefreshSessionToken(
  id: string,
  newTokenHash: string,
  newExpiresAt: Date
): Promise<RefreshSession> {
  if (await isDbAvailable()) {
    try {
      const session = await prisma.refreshSession.update({
        where: { id },
        data: {
          tokenHash: newTokenHash,
          expiresAt: newExpiresAt,
        },
      });
      memorySessions.set(session.id, session);
      return session;
    } catch {
      markDbOffline();
    }
  }

  const existing = memorySessions.get(id);
  if (existing) {
    existing.tokenHash = newTokenHash;
    existing.expiresAt = newExpiresAt;
    memorySessions.set(id, existing);
    return existing;
  }
  const newSession: RefreshSession = {
    id,
    userId: '',
    tokenHash: newTokenHash,
    expiresAt: newExpiresAt,
    createdAt: new Date(),
    revokedAt: null,
  };
  memorySessions.set(id, newSession);
  return newSession;
}

export async function revokeRefreshSession(id: string): Promise<RefreshSession> {
  if (await isDbAvailable()) {
    try {
      const session = await prisma.refreshSession.update({
        where: { id },
        data: {
          revokedAt: new Date(),
        },
      });
      memorySessions.set(session.id, session);
      return session;
    } catch {
      markDbOffline();
    }
  }

  const existing = memorySessions.get(id);
  const revokedAt = new Date();
  if (existing) {
    existing.revokedAt = revokedAt;
    memorySessions.set(id, existing);
    return existing;
  }
  const dummy: RefreshSession = {
    id,
    userId: '',
    tokenHash: 'revoked',
    expiresAt: revokedAt,
    createdAt: revokedAt,
    revokedAt,
  };
  memorySessions.set(id, dummy);
  return dummy;
}

export async function revokeAllRefreshSessionsForUser(userId: string): Promise<number> {
  if (await isDbAvailable()) {
    try {
      const result = await prisma.refreshSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
      return result.count;
    } catch {
      markDbOffline();
    }
  }

  let count = 0;
  const revokedAt = new Date();
  for (const session of memorySessions.values()) {
    if (session.userId === userId && !session.revokedAt) {
      session.revokedAt = revokedAt;
      memorySessions.set(session.id, session);
      count++;
    }
  }
  return count;
}
