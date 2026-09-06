/// <reference types="node" />
import { PrismaClient, Role, RepositoryProvider, RepositoryVisibility } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding development database...');

  const passwordHash = await bcrypt.hash('devpassword123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@devweave.local' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@devweave.local',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const devUser = await prisma.user.upsert({
    where: { email: 'developer@devweave.local' },
    update: {},
    create: {
      name: 'Developer User',
      email: 'developer@devweave.local',
      passwordHash,
      role: Role.DEVELOPER,
    },
  });

  await prisma.repository.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'devweave-app',
      fullName: 'devweave/devweave-app',
      description: 'DevWeave React Frontend Web Application',
      owner: 'devweave',
      visibility: RepositoryVisibility.PUBLIC,
      language: 'TypeScript',
      defaultBranch: 'main',
      stars: 42,
      forks: 5,
      sourceProvider: RepositoryProvider.GITHUB,
      userId: devUser.id,
    },
  });

  console.log(`Seeded Users: ${adminUser.email}, ${devUser.email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1)
  });
