import type { User } from '../generated/prisma/client.js';
import { Role } from '../generated/prisma/enums.js';
import { prisma, isDbAvailable, markDbOffline } from '../config/database.js';
import crypto from 'crypto';

const memoryUsers = new Map<string, User>();

export function clearMemoryUsers(): void {
  memoryUsers.clear();
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();

  if (await isDbAvailable()) {
    try {
      const user = await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });
      if (user) {
        memoryUsers.set(user.id, user);
      }
      return user;
    } catch {
      markDbOffline();
    }
  }

  for (const user of memoryUsers.values()) {
    if (user.email.toLowerCase().trim() === normalizedEmail) {
      return user;
    }
  }
  return null;
}

export async function findUserById(id: string): Promise<User | null> {
  if (await isDbAvailable()) {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id,
        },
      });
      if (user) {
        memoryUsers.set(user.id, user);
      }
      return user;
    } catch {
      markDbOffline();
    }
  }

  return memoryUsers.get(id) || null;
}

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
}): Promise<User> {
  const normalizedEmail = data.email.toLowerCase().trim();

  if (await isDbAvailable()) {
    try {
      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: normalizedEmail,
          passwordHash: data.passwordHash,
          role: data.role ?? Role.DEVELOPER,
        },
      });
      memoryUsers.set(user.id, user);
      return user;
    } catch {
      markDbOffline();
    }
  }

  const user: User = {
    id: crypto.randomUUID(),
    name: data.name,
    email: normalizedEmail,
    passwordHash: data.passwordHash,
    role: data.role ?? Role.DEVELOPER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryUsers.set(user.id, user);
  return user;
}

export async function existsUserByEmail(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  if (await isDbAvailable()) {
    try {
      const user = await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
        select: {
          id: true,
        },
      });

      return user !== null;
    } catch {
      markDbOffline();
    }
  }

  for (const user of memoryUsers.values()) {
    if (user.email.toLowerCase().trim() === normalizedEmail) {
      return true;
    }
  }
  return false;
}