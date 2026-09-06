import type { User } from '../generated/prisma/client.js';
import { Role } from '../generated/prisma/enums.js';
import { prisma } from '../config/database.js';

export async function findUserByEmail(
  email: string
): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();

  return prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });
}

export async function findUserById(
  id: string
): Promise<User | null> {
  return prisma.user.findUnique({
    where: {
      id,
    },
  });
}

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
}): Promise<User> {
  const normalizedEmail = data.email.toLowerCase().trim();

  return prisma.user.create({
    data: {
      name: data.name,
      email: normalizedEmail,
      passwordHash: data.passwordHash,
      role: data.role ?? Role.DEVELOPER,
    },
  });
}

export async function existsUserByEmail(
  email: string
): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
    },
  });

  return user !== null;
}