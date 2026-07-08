import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_DEMO_USER_EMAIL;
  const password = process.env.SEED_DEMO_USER_PASSWORD;

  if (!email || !password) {
    console.log('Skipping seed: SEED_DEMO_USER_EMAIL and SEED_DEMO_USER_PASSWORD are not set.');
    return;
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: await bcrypt.hash(password, 12)
    }
  });

  await prisma.board.upsert({
    where: { id: 'seed_board' },
    update: {},
    create: {
      id: 'seed_board',
      userId: user.id,
      title: 'Demo Board',
      description: 'Optional seed board for local development'
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
