import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({
    data: {
      email: 'demo@example.com',
      password: 'hashed-password-placeholder'
    }
  });

  await prisma.board.create({
    data: {
      title: 'Demo Board',
      description: 'Seed board for local development'
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
